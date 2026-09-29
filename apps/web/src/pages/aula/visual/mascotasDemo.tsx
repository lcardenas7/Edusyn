/** Hoja de contacto de las mascotas de Arena — solo desarrollo. Sirve para
 *  juzgarlas juntas, en grande y en el tamaño real del gajo de la ruleta. */
import { createRoot } from 'react-dom/client'
import '../../../index.css'
import { MASCOTS } from '../arena/mascots'

const COLORES = ['#2E9E63', '#2E6BE6', '#D9437A', '#1C9E8F', '#E0761E', '#B85CD6', '#3C9A4B', '#4A6FA5', '#D1537E', '#6B5BC4', '#0E9F8E', '#C2703D', '#7C5CFF', '#E0A81E']

function Hoja() {
  const items = Object.entries(MASCOTS)
  return (
    <div style={{ background: '#16183D', minHeight: '100vh', padding: 24, color: 'white', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, marginBottom: 16 }}>Mascotas a color (tone="color")</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 12 }}>
        {items.map(([name, M], i) => (
          <div key={name} style={{ textAlign: 'center' }}>
            <div style={{ background: COLORES[i % COLORES.length], borderRadius: 18, padding: 14, display: 'grid', placeItems: 'center' }}>
              <span style={{ color: 'white' }}><M size={64} /></span>
            </div>
            <p style={{ fontSize: 11, marginTop: 6, opacity: .8 }}>{name}</p>
          </div>
        ))}
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 900, margin: '28px 0 16px' }}>Modo plano en la ruleta (24 px, tone="flat")</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, background: '#0E1130', padding: 16, borderRadius: 16 }}>
        {items.map(([name, M]) => <span key={name} style={{ color: 'white' }} title={name}><M size={24} tone="flat" /></span>)}
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 900, margin: '28px 0 16px' }}>Modo plano en píldora</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {items.map(([name, M], i) => (
          <span key={name} style={{ background: COLORES[i % COLORES.length], borderRadius: 999, padding: '6px 14px 6px 6px', display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 12, fontWeight: 700 }}>
            <M size={20} tone="flat" /> {name}
          </span>
        ))}
      </div>
    </div>
  )
}
createRoot(document.getElementById('m')!).render(<Hoja />)
