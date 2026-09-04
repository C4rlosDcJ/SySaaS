import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { publicService } from '../services/api';
import { settingsService } from '../services/api';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

const DEFAULT_SERVICES = [
  { title: 'Celulares', description: 'Pantallas, baterías, puertos de carga, cámaras y más', color: '#4f46e5', icon: 'smartphone' },
  { title: 'Laptops', description: 'Pantallas, teclados, discos duros, memorias y más', color: '#4f46e5', icon: 'laptop' },
  { title: 'Computadoras', description: 'Mantenimiento, upgrades, formateo y reparaciones', color: '#4f46e5', icon: 'monitor' },
  { title: 'Consolas', description: 'PlayStation, Xbox, Nintendo Switch y más', color: '#4f46e5', icon: 'gamepad' },
  { title: 'Smartwatches', description: 'Baterías, pantallas y reparaciones generales', color: '#4f46e5', icon: 'watch' },
  { title: 'Tablets', description: 'iPad, Samsung Tab, pantallas y baterías', color: '#4f46e5', icon: 'tablet' }
];

const DEFAULT_TESTIMONIALS = [
  { name: 'María García', text: 'Excelente servicio, repararon mi iPhone en menos de 2 horas. Muy recomendados!', rating: 5, device: 'iPhone 15 Pro' },
  { name: 'Carlos Rodríguez', text: 'Mi MacBook quedó impecable. Precios transparentes y trato profesional.', rating: 5, device: 'MacBook Pro M2' },
  { name: 'Ana Martínez', text: 'La mejor experiencia en servicio técnico. Sin duda los expertos en la ciudad.', rating: 5, device: 'Samsung Galaxy S24 Ultra' }
];

// Helper: hex → { r, g, b }
const hexToRgb = (hex) => {
  const shorthand = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const full = hex.replace(shorthand, (_, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(full);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null;
};

// Helper: darken a hex color by a given amount (0-255)
const darkenHex = (hex, amount = 40) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const clamp = (v) => Math.max(0, Math.min(255, v));
  const r = clamp(rgb.r - amount).toString(16).padStart(2, '0');
  const g = clamp(rgb.g - amount).toString(16).padStart(2, '0');
  const b = clamp(rgb.b - amount).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
};
// Apply accent color to CSS custom properties on :root
const applyAccentToDOM = (color) => {
  const root = document.documentElement;
  root.style.setProperty('--color-accent', color);

  const rgb = hexToRgb(color);
  if (rgb) {
    root.style.setProperty('--color-accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    // YIQ contrast formula
    const yiq = ((rgb.r * 299) + (rgb.g * 587) + (rgb.b * 114)) / 1000;
    const contrast = (yiq >= 128) ? '#09090b' : '#ffffff';
    root.style.setProperty('--color-accent-contrast', contrast);
  }

  root.style.setProperty('--color-accent-dark', darkenHex(color, 40));
  root.style.setProperty('--color-accent-muted', `${color}1e`);
};// Apply border radius to CSS custom properties on :root
const applyRadiusToDOM = (radius) => {
  const root = document.documentElement;
  root.style.setProperty('--radius-lg', radius);
  const num = parseInt(radius);
  root.style.setProperty('--radius-md', `${Math.max(4, num - 4)}px`);
  root.style.setProperty('--radius-sm', `${Math.max(2, num - 8)}px`);
};

export const ThemeProvider = ({ children }) => {
  // ── Light/Dark theme ──────────────────────────────────────
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  // ── Visual customization (defaults, overridden by API) ────
  const [accentColor, setAccentColor] = useState(() => {
    const saved = localStorage.getItem('accentColor');
    return (saved === '#e63358' || !saved) ? '#4f46e5' : saved;
  });
  const [borderRadius, setBorderRadius] = useState(() => localStorage.getItem('borderRadius') || '12px');
  const [businessName, setBusinessName] = useState(() => localStorage.getItem('businessName') || 'Sys-Teck');
  const [businessLogo, setBusinessLogo] = useState(() => localStorage.getItem('businessLogo') || '');

  // ── Toggles de secciones de Landing Page ──
  const [landingShowStats, setLandingShowStats] = useState(() => localStorage.getItem('landingShowStats') !== 'false');
  const [landingShowWhy, setLandingShowWhy] = useState(() => localStorage.getItem('landingShowWhy') !== 'false');
  const [landingShowServices, setLandingShowServices] = useState(() => localStorage.getItem('landingShowServices') !== 'false');
  const [landingShowProcess, setLandingShowProcess] = useState(() => localStorage.getItem('landingShowProcess') !== 'false');
  const [landingShowTestimonials, setLandingShowTestimonials] = useState(() => localStorage.getItem('landingShowTestimonials') !== 'false');
  const [landingShowCTA, setLandingShowCTA] = useState(() => localStorage.getItem('landingShowCTA') !== 'false');
  const [landingShowContact, setLandingShowContact] = useState(() => localStorage.getItem('landingShowContact') !== 'false');

  // ── Contenido editable de la Landing Page ──
  const [contactAddress, setContactAddress] = useState(() => localStorage.getItem('contactAddress') || 'Av. Principal #123, Ciudad');
  const [contactSchedule, setContactSchedule] = useState(() => localStorage.getItem('contactSchedule') || 'Lun - Sáb: 9AM - 7PM');
  const [contactEmail, setContactEmail] = useState(() => localStorage.getItem('contactEmail') || 'info@sysaas.com');
  const [contactPhone, setContactPhone] = useState(() => localStorage.getItem('contactPhone') || '(123) 456-7890');
  const [defaultWarrantyDays, setDefaultWarrantyDays] = useState(() => localStorage.getItem('defaultWarrantyDays') || '30');
  const [landingServices, setLandingServices] = useState(() => {
    try {
      const saved = localStorage.getItem('landingServices');
      return saved ? JSON.parse(saved) : DEFAULT_SERVICES;
    } catch {
      return DEFAULT_SERVICES;
    }
  });
  const [landingTestimonials, setLandingTestimonials] = useState(() => {
    try {
      const saved = localStorage.getItem('landingTestimonials');
      return saved ? JSON.parse(saved) : DEFAULT_TESTIMONIALS;
    } catch {
      return DEFAULT_TESTIMONIALS;
    }
  });

  // Track whether theme has been loaded from API to avoid overwriting local changes
  const themeLoaded = useRef(false);
  // Track whether changes are user-initiated (admin) vs loaded from API
  const isUserChange = useRef(false);

  // ── Load theme from public API on mount (for ALL visitors) ──
  useEffect(() => {
    const loadThemeFromAPI = async () => {
      try {
        const data = await publicService.getTheme();
        if (data) {
          if (data.accent_color) {
            const mappedColor = data.accent_color === '#e63358' ? '#4f46e5' : data.accent_color;
            setAccentColor(mappedColor);
            localStorage.setItem('accentColor', mappedColor);
          }
          if (data.border_radius) {
            setBorderRadius(data.border_radius);
            localStorage.setItem('borderRadius', data.border_radius);
          }
          if (data.business_name) {
            setBusinessName(data.business_name);
            localStorage.setItem('businessName', data.business_name);
          }
          // business_logo can be empty string intentionally
          if (data.business_logo !== undefined) {
            setBusinessLogo(data.business_logo);
            localStorage.setItem('businessLogo', data.business_logo);
          }

          // Cargar toggles de landing
          if (data.landing_show_stats !== undefined) {
            const val = data.landing_show_stats === 'true';
            setLandingShowStats(val);
            localStorage.setItem('landingShowStats', val.toString());
          }
          if (data.landing_show_why !== undefined) {
            const val = data.landing_show_why === 'true';
            setLandingShowWhy(val);
            localStorage.setItem('landingShowWhy', val.toString());
          }
          if (data.landing_show_services !== undefined) {
            const val = data.landing_show_services === 'true';
            setLandingShowServices(val);
            localStorage.setItem('landingShowServices', val.toString());
          }
          if (data.landing_show_process !== undefined) {
            const val = data.landing_show_process === 'true';
            setLandingShowProcess(val);
            localStorage.setItem('landingShowProcess', val.toString());
          }
          if (data.landing_show_testimonials !== undefined) {
            const val = data.landing_show_testimonials === 'true';
            setLandingShowTestimonials(val);
            localStorage.setItem('landingShowTestimonials', val.toString());
          }
          if (data.landing_show_cta !== undefined) {
            const val = data.landing_show_cta === 'true';
            setLandingShowCTA(val);
            localStorage.setItem('landingShowCTA', val.toString());
          }
          if (data.landing_show_contact !== undefined) {
            const val = data.landing_show_contact === 'true';
            setLandingShowContact(val);
            localStorage.setItem('landingShowContact', val.toString());
          }

          // Cargar contenidos editables
          if (data.contact_address !== undefined) {
            setContactAddress(data.contact_address);
            localStorage.setItem('contactAddress', data.contact_address);
          }
          if (data.contact_schedule !== undefined) {
            setContactSchedule(data.contact_schedule);
            localStorage.setItem('contactSchedule', data.contact_schedule);
          }
          if (data.contact_email !== undefined) {
            setContactEmail(data.contact_email);
            localStorage.setItem('contactEmail', data.contact_email);
          }
          if (data.contact_phone !== undefined) {
            setContactPhone(data.contact_phone);
            localStorage.setItem('contactPhone', data.contact_phone);
          }
          if (data.default_warranty_days !== undefined) {
            setDefaultWarrantyDays(data.default_warranty_days);
            localStorage.setItem('defaultWarrantyDays', data.default_warranty_days);
          }
          if (data.landing_services !== undefined) {
            try {
              const parsed = JSON.parse(data.landing_services);
              setLandingServices(parsed);
              localStorage.setItem('landingServices', data.landing_services);
            } catch (e) {
              console.warn('Error parsing landing_services:', e);
            }
          }
          if (data.reviews && data.reviews.length > 0) {
            setLandingTestimonials(data.reviews);
            localStorage.setItem('landingTestimonials', JSON.stringify(data.reviews));
          } else if (data.landing_testimonials !== undefined) {
            try {
              const parsed = JSON.parse(data.landing_testimonials);
              setLandingTestimonials(parsed);
              localStorage.setItem('landingTestimonials', data.landing_testimonials);
            } catch (e) {
              console.warn('Error parsing landing_testimonials:', e);
            }
          }
        }
      } catch (err) {
        console.warn('[Theme] No se pudo cargar el tema desde la API, usando valores locales:', err.message);
      } finally {
        themeLoaded.current = true;
      }
    };

    loadThemeFromAPI();
  }, []);

  // ── Apply light/dark theme ────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // ── Apply accent color to DOM ─────────────────────────────
  useEffect(() => {
    applyAccentToDOM(accentColor);
    localStorage.setItem('accentColor', accentColor);
  }, [accentColor]);

  // ── Apply border radius to DOM ────────────────────────────
  useEffect(() => {
    applyRadiusToDOM(borderRadius);
    localStorage.setItem('borderRadius', borderRadius);
  }, [borderRadius]);

  // ── Persist business name locally ──
  useEffect(() => {
    localStorage.setItem('businessName', businessName);
  }, [businessName]);

  // ── Persist business logo locally ──
  useEffect(() => {
    localStorage.setItem('businessLogo', businessLogo);
  }, [businessLogo]);

  // ── Admin: persist visual settings to DB ──────────────────
  // Wrapped setters that also save to the backend
  const setAccentColorAndPersist = (color) => {
    isUserChange.current = true;
    setAccentColor(color);
    // Save to DB asynchronously
    settingsService.update({ accent_color: color }).catch((err) => {
      console.warn('[Theme] Error al guardar color en BD:', err.message);
    });
  };

  const setBorderRadiusAndPersist = (radius) => {
    isUserChange.current = true;
    setBorderRadius(radius);
    settingsService.update({ border_radius: radius }).catch((err) => {
      console.warn('[Theme] Error al guardar radio en BD:', err.message);
    });
  };

  const setBusinessLogoAndPersist = (logo) => {
    isUserChange.current = true;
    setBusinessLogo(logo);
    settingsService.update({ business_logo: logo }).catch((err) => {
      console.warn('[Theme] Error al guardar logo en BD:', err.message);
    });
  };

  // Setters persistidores para toggles de landing
  const setLandingShowStatsAndPersist = (val) => {
    setLandingShowStats(val);
    localStorage.setItem('landingShowStats', val.toString());
    settingsService.update({ landing_show_stats: val.toString() }).catch((err) => {
      console.warn('[Theme] Error al guardar toggle de stats en BD:', err.message);
    });
  };

  const setLandingShowWhyAndPersist = (val) => {
    setLandingShowWhy(val);
    localStorage.setItem('landingShowWhy', val.toString());
    settingsService.update({ landing_show_why: val.toString() }).catch((err) => {
      console.warn('[Theme] Error al guardar toggle de why en BD:', err.message);
    });
  };

  const setLandingShowServicesAndPersist = (val) => {
    setLandingShowServices(val);
    localStorage.setItem('landingShowServices', val.toString());
    settingsService.update({ landing_show_services: val.toString() }).catch((err) => {
      console.warn('[Theme] Error al guardar toggle de services en BD:', err.message);
    });
  };

  const setLandingShowProcessAndPersist = (val) => {
    setLandingShowProcess(val);
    localStorage.setItem('landingShowProcess', val.toString());
    settingsService.update({ landing_show_process: val.toString() }).catch((err) => {
      console.warn('[Theme] Error al guardar toggle de process en BD:', err.message);
    });
  };

  const setLandingShowTestimonialsAndPersist = (val) => {
    setLandingShowTestimonials(val);
    localStorage.setItem('landingShowTestimonials', val.toString());
    settingsService.update({ landing_show_testimonials: val.toString() }).catch((err) => {
      console.warn('[Theme] Error al guardar toggle de testimonials en BD:', err.message);
    });
  };

  const setLandingShowCTAAndPersist = (val) => {
    setLandingShowCTA(val);
    localStorage.setItem('landingShowCTA', val.toString());
    settingsService.update({ landing_show_cta: val.toString() }).catch((err) => {
      console.warn('[Theme] Error al guardar toggle de cta en BD:', err.message);
    });
  };

  const setLandingShowContactAndPersist = (val) => {
    setLandingShowContact(val);
    localStorage.setItem('landingShowContact', val.toString());
    settingsService.update({ landing_show_contact: val.toString() }).catch((err) => {
      console.warn('[Theme] Error al guardar toggle de contact en BD:', err.message);
    });
  };

  // Setters persistidores para contenidos editables
  const setContactAddressAndPersist = (val) => {
    setContactAddress(val);
    localStorage.setItem('contactAddress', val);
    settingsService.update({ contact_address: val }).catch((err) => {
      console.warn('[Theme] Error al guardar dirección de contacto en BD:', err.message);
    });
  };

  const setContactScheduleAndPersist = (val) => {
    setContactSchedule(val);
    localStorage.setItem('contactSchedule', val);
    settingsService.update({ contact_schedule: val }).catch((err) => {
      console.warn('[Theme] Error al guardar horario de contacto en BD:', err.message);
    });
  };

  const setContactEmailAndPersist = (val) => {
    setContactEmail(val);
    localStorage.setItem('contactEmail', val);
    settingsService.update({ contact_email: val }).catch((err) => {
      console.warn('[Theme] Error al guardar correo de contacto en BD:', err.message);
    });
  };

  const setContactPhoneAndPersist = (val) => {
    setContactPhone(val);
    localStorage.setItem('contactPhone', val);
    settingsService.update({ contact_phone: val }).catch((err) => {
      console.warn('[Theme] Error al guardar teléfono de contacto en BD:', err.message);
    });
  };

  const setLandingServicesAndPersist = (val) => {
    setLandingServices(val);
    const str = JSON.stringify(val);
    localStorage.setItem('landingServices', str);
    settingsService.update({ landing_services: str }).catch((err) => {
      console.warn('[Theme] Error al guardar lista de servicios en BD:', err.message);
    });
  };

  const setLandingTestimonialsAndPersist = (val) => {
    setLandingTestimonials(val);
    const str = JSON.stringify(val);
    localStorage.setItem('landingTestimonials', str);
    settingsService.update({ landing_testimonials: str }).catch((err) => {
      console.warn('[Theme] Error al guardar lista de testimonios en BD:', err.message);
    });
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{
      theme,
      toggleTheme,
      accentColor,
      setAccentColor: setAccentColorAndPersist,
      borderRadius,
      setBorderRadius: setBorderRadiusAndPersist,
      businessName,
      setBusinessName,
      businessLogo,
      setBusinessLogo: setBusinessLogoAndPersist,
      // Toggles de la Landing Page
      landingShowStats,
      setLandingShowStats: setLandingShowStatsAndPersist,
      landingShowWhy,
      setLandingShowWhy: setLandingShowWhyAndPersist,
      landingShowServices,
      setLandingShowServices: setLandingShowServicesAndPersist,
      landingShowProcess,
      setLandingShowProcess: setLandingShowProcessAndPersist,
      landingShowTestimonials,
      setLandingShowTestimonials: setLandingShowTestimonialsAndPersist,
      landingShowCTA,
      setLandingShowCTA: setLandingShowCTAAndPersist,
      landingShowContact,
      setLandingShowContact: setLandingShowContactAndPersist,
      // Contenidos editables de la Landing Page
      contactAddress,
      setContactAddress: setContactAddressAndPersist,
      contactSchedule,
      setContactSchedule: setContactScheduleAndPersist,
      contactEmail,
      setContactEmail: setContactEmailAndPersist,
      contactPhone,
      setContactPhone: setContactPhoneAndPersist,
      defaultWarrantyDays,
      landingServices,
      setLandingServices: setLandingServicesAndPersist,
      landingTestimonials,
      setLandingTestimonials: setLandingTestimonialsAndPersist
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
