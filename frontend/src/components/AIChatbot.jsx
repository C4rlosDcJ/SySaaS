import { useState, useRef, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { aiService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { useTheme } from '../context/ThemeContext';
import { MessageSquare, X, Send, Sparkles, RefreshCw, Shield, Store, Wrench, User, CreditCard, Trash2, ArrowDown } from 'lucide-react';
import './AIChatbot.css';

export default function AIChatbot() {
    const [isOpen, setIsOpen] = useState(false);
    const { user } = useAuth();
    const { tenant } = useTenant();
    const { theme } = useTheme?.() || { theme: 'dark' };
    const location = useLocation();

    const role = user?.role || 'public';
    const companyName = tenant?.company_name || 'SySaaS';

    // Persona definition based on current session
    const persona = useMemo(() => {
        if (!user) {
            return {
                title: 'SySaaS AI',
                subtitle: 'Asistente Comercial Oficial',
                badge: 'SaaS Asesor',
                icon: Sparkles,
                initialMessage: 'Hola, soy el Asistente Oficial de SySaaS. Te puedo explicar nuestros planes de suscripcion (Basico, Pro, Enterprise), funciones del sistema, o ayudarte a rastrear un equipo en reparacion con tu numero de ticket.',
                quickPrompts: [
                    '¿Que incluye el Plan Pro?',
                    '¿Como funciona la prueba gratis?',
                    '¿Tienen punto de venta y WhatsApp?',
                    'Rastrear un ticket'
                ]
            };
        }

        if (role === 'superadmin') {
            return {
                title: 'SySaaS SuperAdmin AI',
                subtitle: 'Copiloto de Plataforma',
                badge: 'SuperAdmin',
                icon: Sparkles,
                initialMessage: `Hola ${user.first_name || 'SuperAdmin'}, soy tu copiloto de administracion global. Puedo brindarte metricas de la plataforma, estado de suscripciones de empresas, planes y navegacion de control.`,
                quickPrompts: [
                    'Resumen de empresas activas',
                    'Empresas en periodo de prueba',
                    'Planes y limites configurados',
                    'Navegacion de superadministrador'
                ]
            };
        }

        if (role === 'admin' || role === 'tenant_admin') {
            return {
                title: `${companyName} AI`,
                subtitle: 'Copiloto de Gestion',
                badge: 'Gerencia',
                icon: Sparkles,
                initialMessage: `Hola ${user.first_name || 'Administrador'}, soy tu asistente de administracion para ${companyName}. Puedo asistirte con estadisticas de reparaciones, alertas de inventario bajo, ventas del mes y consulta de ordenes.`,
                quickPrompts: [
                    'Reparaciones pendientes hoy',
                    'Productos con bajo stock',
                    'Resumen de ventas del mes',
                    'Rastrear un ticket'
                ]
            };
        }

        if (role === 'technician') {
            return {
                title: `${companyName} Taller AI`,
                subtitle: 'Asistente Tecnico de Banco',
                badge: 'Tecnico',
                icon: Sparkles,
                initialMessage: `Hola ${user.first_name || 'Tecnico'}, soy tu asistente de banco de trabajo en ${companyName}. Puedo ayudarte a revisar tus equipos asignados pendientes, buscar refacciones o redactar notas de diagnostico.`,
                quickPrompts: [
                    'Mis reparaciones pendientes',
                    'Consultar refacciones en stock',
                    'Catalogo de servicios y precios',
                    'Redactar nota tecnica'
                ]
            };
        }

        if (role === 'cashier' || role === 'salesperson') {
            return {
                title: `${companyName} POS AI`,
                subtitle: 'Asistente de Mostrador y Ventas',
                badge: 'Caja / Recepcion',
                icon: Sparkles,
                initialMessage: `Hola ${user.first_name || 'Cajero'}, soy tu asistente de mostrador para ${companyName}. Preguntame precios de servicios en catalogo, disponibilidad de stock o politicas de garantia para clientes.`,
                quickPrompts: [
                    'Servicios mas comunes y precios',
                    'Consultar disponibilidad de producto',
                    'Politica de garantia',
                    'Rastrear ticket de cliente'
                ]
            };
        }

        if (role === 'client') {
            return {
                title: `${companyName} Atencion`,
                subtitle: 'Asistente al Cliente',
                badge: 'Cliente',
                icon: Sparkles,
                initialMessage: `Hola ${user.first_name || 'Estimado cliente'}, soy tu asistente virtual en ${companyName}. ¿En que puedo ayudarte hoy? Puedes consultarme sobre el estado de tus reparaciones o compras.`,
                quickPrompts: [
                    'Estado de mis reparaciones',
                    '¿Que garantia tienen mis reparaciones?',
                    'Mis compras realizadas',
                    'Horarios de atencion'
                ]
            };
        }

        return {
            title: `${companyName} AI`,
            subtitle: 'Asistente de Sistema',
            badge: 'Usuario',
            icon: Sparkles,
            initialMessage: `Hola ${user.first_name || ''}, soy el asistente de ${companyName}. ¿En que puedo ayudarte hoy?`,
            quickPrompts: [
                'Servicios disponibles',
                'Rastrear un ticket',
                'Garantias de servicio'
            ]
        };
    }, [user, role, companyName]);

    const getCurrentTime = () => {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            text: persona.initialMessage,
            time: getCurrentTime()
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [showScrollBottom, setShowScrollBottom] = useState(false);
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const inputRef = useRef(null);

    const personaKey = `${role}_${tenant?.id || 'none'}_${companyName}`;
    const prevPersonaKeyRef = useRef(personaKey);

    // Reiniciar conversación al cambiar de rol, empresa o entorno (ej: entrar/salir de impersonación)
    useEffect(() => {
        if (prevPersonaKeyRef.current !== personaKey) {
            prevPersonaKeyRef.current = personaKey;
            setMessages([
                {
                    role: 'assistant',
                    text: persona.initialMessage,
                    time: getCurrentTime()
                }
            ]);
        }
    }, [personaKey, persona.initialMessage]);

    const scrollToBottom = (behavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    };

    const handleScroll = () => {
        if (!messagesContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 80;
        setShowScrollBottom(!isNearBottom);
    };

    // Formatea el texto del mensaje para renderizar con estetica limpia, jerarquia y sin emojis
    const formatMessage = (text) => {
        if (!text) return '';
        // Eliminar emojis residuales
        let cleaned = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}]/gu, '');
        // Eliminar negritas markdown **texto** -> negrita limpia con span
        cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '<strong class="chat-strong">$1</strong>');
        // Eliminar itálicas markdown *texto* -> texto
        cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');
        // Encabezados markdown (# o ##) -> subtitulo estilizado
        cleaned = cleaned.replace(/^#{1,6}\s+(.+)$/gm, '<div class="chat-section-header">$1</div>');
        
        // Convertir lineas de listas (- o •) en items con bullets estilizados
        const lines = cleaned.split('\n');
        const formatted = lines.map(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
                const itemContent = trimmed.replace(/^[-•]\s+/, '');
                return `<div class="chat-list-item"><span class="chat-list-bullet"></span><span class="chat-list-text">${itemContent}</span></div>`;
            }
            if (trimmed === '') return '<div class="chat-spacing"></div>';
            return `<div class="chat-text-line">${line}</div>`;
        }).join('');

        return formatted;
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom('auto');
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            scrollToBottom('smooth');
        }
    }, [messages, loading]);

    const handleClearChat = () => {
        setMessages([
            {
                role: 'assistant',
                text: persona.initialMessage,
                time: getCurrentTime()
            }
        ]);
    };

    const handleSend = async (textToSend) => {
        const text = textToSend || input;
        if (!text.trim()) return;

        if (!textToSend) setInput('');
        const userTime = getCurrentTime();
        setMessages(prev => [...prev, { role: 'user', text, time: userTime }]);
        setLoading(true);

        try {
            // Filtrar ultimos 6 mensajes para contexto e historial
            const history = messages
                .slice(-6)
                .map(m => ({ role: m.role, text: m.text }));

            const contextData = {
                path: location.pathname,
                tenant_slug: tenant?.slug || null,
                company_name: tenant?.company_name || null
            };

            const response = await aiService.chat(text, history, contextData);
            const assistantTime = getCurrentTime();
            setMessages(prev => [...prev, { role: 'assistant', text: response.reply, time: assistantTime }]);
        } catch (error) {
            console.error('Error in chatbot communication:', error);
            const assistantTime = getCurrentTime();
            setMessages(prev => [
                ...prev,
                { role: 'assistant', text: 'Lo siento, tuve un problema al conectarme con el servicio de IA. Intentalo de nuevo en unos momentos.', time: assistantTime }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleQuickPrompt = (prompt) => {
        if (prompt.toLowerCase().includes('rastrear')) {
            const assistantTime = getCurrentTime();
            setMessages(prev => [
                ...prev,
                { role: 'assistant', text: 'Por favor, escribe el numero de ticket directamente en el chat para buscarlo (formato: REP-AAMMDD-XXXX o REP-XXXX).', time: assistantTime }
            ]);
        } else {
            handleSend(prompt);
        }
    };

    return (
        <div className="ai-chatbot-wrapper">
            {/* Boton Flotante */}
            {!isOpen && (
                <button 
                    className="chatbot-trigger-btn" 
                    onClick={() => setIsOpen(true)}
                    title={persona.title}
                    aria-label="Abrir Asistente Virtual"
                >
                    <MessageSquare size={20} className="trigger-icon" />
                </button>
            )}

            {/* Ventana de Chat */}
            {isOpen && (
                <div className="chatbot-window animate-fadeIn">
                    <header className="chatbot-header">
                        <div className="chatbot-header-info">
                            <div className="chatbot-avatar-glow">
                                {(() => {
                                    const PersonaIcon = persona.icon || MessageSquare;
                                    return <PersonaIcon size={16} className="avatar-icon" />;
                                })()}
                            </div>
                            <div className="chatbot-title-block">
                                <div className="chatbot-title-row">
                                    <h3>{persona.title}</h3>
                                    <span className="chatbot-role-pill">{persona.badge}</span>
                                </div>
                                <span className="chatbot-status">{persona.subtitle}</span>
                            </div>
                        </div>
                        <div className="chatbot-header-actions">
                            <button 
                                className="chatbot-action-btn" 
                                onClick={handleClearChat}
                                title="Limpiar conversacion"
                                aria-label="Limpiar conversacion"
                            >
                                <Trash2 size={15} />
                            </button>
                            <button 
                                className="chatbot-close-btn" 
                                onClick={() => setIsOpen(false)} 
                                title="Cerrar chat"
                                aria-label="Cerrar chat"
                            >
                                <X size={17} />
                            </button>
                        </div>
                    </header>

                    <div 
                        className="chatbot-messages" 
                        ref={messagesContainerRef}
                        onScroll={handleScroll}
                    >
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`chat-bubble-wrapper ${msg.role}`}>
                                <div className={`chat-bubble ${msg.role}`}>
                                    <div
                                        className="chat-bubble-content"
                                        dangerouslySetInnerHTML={{ __html: formatMessage(msg.text) }}
                                    />
                                    {msg.time && (
                                        <div className="chat-bubble-footer">
                                            <span className="chat-bubble-time">{msg.time}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="chat-bubble-wrapper assistant">
                                <div className="chat-bubble assistant loading">
                                    <div className="chat-typing-indicator">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                    <span className="typing-label">Consultando informacion...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {showScrollBottom && (
                        <button 
                            className="chatbot-scroll-bottom-btn"
                            onClick={() => scrollToBottom('smooth')}
                            title="Ir al ultimo mensaje"
                        >
                            <ArrowDown size={14} />
                        </button>
                    )}

                    {/* Quick Prompts */}
                    {messages.length <= 2 && (
                        <div className="quick-prompts-container">
                            <div className="quick-prompts-title">Sugerencias rapidas:</div>
                            <div className="quick-prompts-list">
                                {persona.quickPrompts.map((prompt, idx) => (
                                    <button 
                                        key={idx} 
                                        className="quick-prompt-btn"
                                        onClick={() => handleQuickPrompt(prompt)}
                                    >
                                        {prompt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <form 
                        className="chatbot-input-area"
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSend();
                        }}
                    >
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Escribe tu consulta o ticket (REP-...)..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={loading}
                        />
                        <button 
                            type="submit" 
                            className="chatbot-send-btn" 
                            disabled={loading || !input.trim()}
                            title="Enviar mensaje"
                        >
                            <Send size={15} />
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}
