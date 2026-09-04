import Navbar from '../components/Navbar';
import CatalogSection from '../components/CatalogSection';
import { ShoppingBag, ArrowRight, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import './PublicStorePage.css';

export default function PublicStorePage() {
    const { businessName } = useTheme();
    return (
        <div className="public-store-page">
            <Navbar />
            
            {/* Main Store Catalog */}
            <main className="store-main-container animate-fadeIn" style={{ paddingTop: '100px' }}>
                <CatalogSection embedded={true} showCartButton={true} />
            </main>

            {/* Footer */}
            <footer className="footer">
                <div className="container">
                    <div className="footer-content">
                        <div className="footer-brand">
                            <div className="footer-logo">
                                <Wrench size={24} className="text-primary" />
                                <span>{businessName || 'SySaaS'}</span>
                            </div>
                            <p>Servicio técnico profesional para todos tus dispositivos electrónicos.</p>
                        </div>
                        <div className="footer-links">
                            <div className="footer-col">
                                <h4>Servicios</h4>
                                <Link to="/#servicios">Celulares</Link>
                                <Link to="/#servicios">Laptops</Link>
                                <Link to="/#servicios">Consolas</Link>
                            </div>
                            <div className="footer-col">
                                <h4>Empresa</h4>
                                <Link to="/#proceso">Proceso</Link>
                                <Link to="/#contacto">Contacto</Link>
                                <Link to="/rastrear">Rastrear</Link>
                            </div>
                        </div>
                    </div>
                    <div className="footer-bottom">
                        <p>© {new Date().getFullYear()} {businessName || 'SySaaS'}. Todos los derechos reservados.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
