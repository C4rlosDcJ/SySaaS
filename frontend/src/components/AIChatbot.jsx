import { useState, useRef, useEffect } from 'react';
import { aiService } from '../services/api';
import { MessageSquare, X, Send, Sparkles, RefreshCw, Smartphone, Wrench } from 'lucide-react';
import './AIChatbot.css';

export default function AIChatbot() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            text: 'Hola, soy el asistente virtual de SySaaS. ¿En qué puedo ayudarte hoy? Puedes preguntarme sobre reparaciones, cotizaciones o escribir un número de ticket para rastrearlo (ej: REP-260625-1234).'
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const quickPrompts = [
        '¿Cómo solicito una cotización?',
        '¿Qué tipos de equipos reparan?',
        '¿Tienen garantía las reparaciones?',
        'Rastrear un ticket'
    ];

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Formatea el texto del mensaje para renderizar correctamente
    const formatMessage = (text) => {
        if (!text) return '';
        // Eliminar emojis residuales
        let cleaned = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}]/gu, '');
        // Eliminar negritas markdown **texto** → texto
        cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1');
        // Eliminar itálicas markdown *texto* → texto
        cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');
        // Eliminar encabezados markdown
        cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');
        // Escapar HTML
        cleaned = cleaned.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        // Convertir líneas que empiezan con - en items de lista con estilo
        const lines = cleaned.split('\n');
        const formatted = lines.map(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('- ')) {
                return `<div class="chat-list-item">${trimmed.substring(2)}</div>`;
            }
            if (trimmed === '') return '<br/>';
            return `<span>${line}</span><br/>`;
        }).join('');
        // Limpiar <br/> duplicados al final
        return formatted.replace(/(<br\/>)+$/g, '');
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);

    const handleSend = async (textToSend) => {
        const text = textToSend || input;
        if (!text.trim()) return;

        if (!textToSend) setInput('');
        setMessages(prev => [...prev, { role: 'user', text }]);
        setLoading(true);

        try {
            // Filtrar últimos 6 mensajes para contexto e historial
            const history = messages
                .slice(-6)
                .map(m => ({ role: m.role, text: m.text }));

            const response = await aiService.chat(text, history);
            setMessages(prev => [...prev, { role: 'assistant', text: response.reply }]);
        } catch (error) {
            console.error('Error in chatbot communication:', error);
            setMessages(prev => [
                ...prev,
                { role: 'assistant', text: 'Lo siento, tuve un problema al conectarme con mis servidores de IA. Inténtalo de nuevo en unos momentos.' }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleQuickPrompt = (prompt) => {
        if (prompt === 'Rastrear un ticket') {
            setMessages(prev => [
                ...prev,
                { role: 'assistant', text: 'Por favor, escribe tu número de ticket directamente en el chat para buscarlo (debe tener el formato: REP-AAMMDD-XXXX).' }
            ]);
        } else {
            handleSend(prompt);
        }
    };

    return (
        <div className="ai-chatbot-wrapper">
            {/* Botón Flotante */}
            {!isOpen && (
                <button 
                    className="chatbot-trigger-btn" 
                    onClick={() => setIsOpen(true)}
                    title="Asistente Virtual"
                >
                    <MessageSquare size={20} />
                </button>
            )}

            {/* Ventana de Chat */}
            {isOpen && (
                <div className="chatbot-window animate-fadeIn">
                    <header className="chatbot-header">
                        <div className="chatbot-header-info">
                            <div className="chatbot-avatar-glow">
                                <Sparkles size={16} className="sparkle-icon" />
                            </div>
                            <div>
                                <h3>SySaaS AI</h3>
                                <span className="chatbot-status">En línea</span>
                            </div>
                        </div>
                        <button className="chatbot-close-btn" onClick={() => setIsOpen(false)}>
                            <X size={18} />
                        </button>
                    </header>

                    <div className="chatbot-messages">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`chat-bubble-wrapper ${msg.role}`}>
                                <div className={`chat-bubble ${msg.role}`}>
                                    <div
                                        className="chat-bubble-content"
                                        dangerouslySetInnerHTML={{ __html: formatMessage(msg.text) }}
                                    />
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="chat-bubble-wrapper assistant">
                                <div className="chat-bubble assistant loading">
                                    <RefreshCw size={14} className="animate-spin" />
                                    <span>Pensando...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Prompts */}
                    {messages.length === 1 && (
                        <div className="quick-prompts-container">
                            {quickPrompts.map((prompt, idx) => (
                                <button 
                                    key={idx} 
                                    className="quick-prompt-btn"
                                    onClick={() => handleQuickPrompt(prompt)}
                                >
                                    {prompt}
                                </button>
                            ))}
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
                            type="text"
                            placeholder="Escribe tu mensaje o ticket..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={loading}
                        />
                        <button type="submit" className="chatbot-send-btn" disabled={loading || !input.trim()}>
                            <Send size={16} />
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}
