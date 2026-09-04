import Swal from 'sweetalert2';

// Configuración de tema adaptado al diseño de SySaaS (oscuro/claro con colores de acento)
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
    // Detectar tema dinámicamente en el clic
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

// Reemplazo global del objeto window.alert
if (typeof window !== 'undefined') {
    window.alert = (message) => {
        const text = String(message || '');
        const isError = text.toLowerCase().includes('error') || text.toLowerCase().includes('no encontrada') || text.toLowerCase().includes('inválid');
        showAlert({ 
            title: isError ? 'Error' : 'Notificación', 
            text, 
            icon: isError ? 'error' : 'info' 
        });
    };
}
