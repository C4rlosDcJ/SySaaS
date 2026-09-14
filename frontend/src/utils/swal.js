import Swal from 'sweetalert2';

// Configuracion de tema adaptado al diseno de SySaaS (oscuro/claro con colores de acento)
const isDark = () => document.body.classList.contains('dark') || document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark';

const sysSwal = Swal.mixin({
    customClass: {
        popup: 'swal-premium-popup',
        title: 'swal-premium-title',
        htmlContainer: 'swal-premium-text',
        confirmButton: 'btn btn-primary',
        cancelButton: 'btn btn-secondary'
    },
    buttonsStyling: false,
    background: isDark() ? '#1e1e1e' : '#ffffff',
    color: isDark() ? '#ffffff' : '#1f2937'
});

export const showAlert = ({ title, text, icon = 'info', confirmText = 'Aceptar', showCancel = false, cancelText = 'Cancelar' }) => {
    const darkActive = isDark();
    return sysSwal.fire({
        title,
        text,
        icon,
        background: darkActive ? '#1e1e1e' : '#ffffff',
        color: darkActive ? '#ffffff' : '#1f2937',
        confirmButtonText: confirmText,
        showCancelButton: showCancel,
        cancelButtonText: cancelText,
        reverseButtons: true
    });
};

export const showConfirm = ({ title, text, icon = 'warning', confirmText = 'Confirmar', cancelText = 'Cancelar' }) => {
    return showAlert({
        title,
        text,
        icon,
        confirmText,
        showCancel: true,
        cancelText
    }).then(res => res.isConfirmed);
};

// Toast rapido para notificaciones de exito / error / info (ubicado en top-end para no tapar paneles de accion inferiores)
const swalToast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    buttonsStyling: false,
    didOpen: (toast) => {
        toast.onmouseenter = Swal.stopTimer;
        toast.onmouseleave = Swal.resumeTimer;
    }
});

export const showToastSwal = (message, type = 'success') => {
    const iconMap = { success: 'success', error: 'error', warning: 'warning', info: 'info' };
    swalToast.fire({
        icon: iconMap[type] || 'info',
        title: message,
        background: isDark() ? '#1e1e24' : '#ffffff',
        color: isDark() ? '#ffffff' : '#1f2937'
    });
};

// Input dialog — reemplaza window.prompt con un modal tematizado
export const showInputPrompt = ({ title, label, placeholder = '', inputType = 'number', validationMessage = '' }) => {
    const darkActive = isDark();
    return Swal.fire({
        title,
        input: inputType,
        inputLabel: label,
        inputPlaceholder: placeholder,
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        confirmButtonText: 'Aplicar',
        background: darkActive ? '#1e1e24' : '#ffffff',
        color: darkActive ? '#ffffff' : '#1f2937',
        customClass: {
            popup: 'swal-premium-popup',
            confirmButton: 'btn btn-primary',
            cancelButton: 'btn btn-secondary'
        },
        buttonsStyling: false,
        reverseButtons: true,
        inputValidator: (value) => {
            if (!value || value.trim() === '') return 'Debes ingresar un valor.';
            if (validationMessage) {
                const num = parseFloat(value);
                if (isNaN(num) || num < 0 || num > 100) return validationMessage;
            }
        }
    });
};

// Reemplazo global del objeto window.alert
if (typeof window !== 'undefined') {
    window.alert = (message) => {
        const text = String(message || '');
        const isError = text.toLowerCase().includes('error') || text.toLowerCase().includes('no encontrada') || text.toLowerCase().includes('invalido');
        showAlert({
            title: isError ? 'Error' : 'Notificacion',
            text,
            icon: isError ? 'error' : 'info'
        });
    };
}
