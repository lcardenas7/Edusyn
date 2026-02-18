import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Settings as SettingsIcon, Save, RefreshCw, Plus, Trash2, Upload, Image, ChevronDown, ChevronRight, FileText, Building2, Palette, CreditCard, Bell, Shield } from 'lucide-react'
import { financeSettingsApi, storageApi } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'

interface BankAccount {
  bankName: string
  accountNumber: string
  accountType: string
  holderName: string
}

interface FinancialSettingsData {
  // Numeración
  invoicePrefix: string
  receiptPrefix: string
  // Mora
  defaultLateFeeType: string | null
  defaultLateFeeValue: number | null
  defaultGracePeriodDays: number
  // Modo facturación
  billingMode: string
  // Datos fiscales / DIAN
  taxId: string | null
  businessName: string | null
  taxRegime: string | null
  ciiu: string | null
  economicActivity: string | null
  // Resolución DIAN
  invoiceResolution: string | null
  invoiceResolutionDate: string | null
  invoiceResolutionPrefix: string | null
  invoiceRangeFrom: number | null
  invoiceRangeTo: number | null
  // Visual
  invoiceLogoUrl: string | null
  invoicePageSize: string
  invoicePrimaryColor: string | null
  invoiceSecondaryColor: string | null
  invoiceFooterText: string | null
  invoiceShowQR: boolean
  invoiceShowBankAccounts: boolean
  // Contacto
  invoiceCity: string | null
  invoiceAddress: string | null
  invoicePhone: string | null
  invoiceEmail: string | null
  // Cuentas bancarias
  bankAccounts: BankAccount[] | null
  // Notificaciones
  sendPaymentReminders: boolean
  reminderDaysBefore: number
  // Proveedor electrónico
  electronicProvider: string | null
  electronicProviderKey: string | null
  electronicProviderUrl: string | null
}

export default function FinanceSettings() {
  const { institution } = useAuth()
  const [settings, setSettings] = useState<FinancialSettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    billing: true, fiscal: true, visual: true, resolution: false, bank: true, notifications: false, electronic: false,
  })

  const fetchSettings = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await financeSettingsApi.get()
      // Ensure we have default values for required fields
      const data = response.data || {}
      setSettings({
        invoicePrefix: data.invoicePrefix || 'FAC',
        receiptPrefix: data.receiptPrefix || 'REC',
        defaultLateFeeType: data.defaultLateFeeType || null,
        defaultLateFeeValue: data.defaultLateFeeValue ?? null,
        defaultGracePeriodDays: data.defaultGracePeriodDays ?? 0,
        billingMode: data.billingMode || 'INTERNAL_ONLY',
        taxId: data.taxId || null,
        businessName: data.businessName || null,
        taxRegime: data.taxRegime || null,
        ciiu: data.ciiu || null,
        economicActivity: data.economicActivity || null,
        invoiceResolution: data.invoiceResolution || null,
        invoiceResolutionDate: data.invoiceResolutionDate || null,
        invoiceResolutionPrefix: data.invoiceResolutionPrefix || null,
        invoiceRangeFrom: data.invoiceRangeFrom ?? null,
        invoiceRangeTo: data.invoiceRangeTo ?? null,
        invoiceLogoUrl: data.invoiceLogoUrl || null,
        invoicePageSize: data.invoicePageSize || 'LETTER',
        invoicePrimaryColor: data.invoicePrimaryColor || '#1E40AF',
        invoiceSecondaryColor: data.invoiceSecondaryColor || '#F0F9FF',
        invoiceFooterText: data.invoiceFooterText || null,
        invoiceShowQR: data.invoiceShowQR ?? true,
        invoiceShowBankAccounts: data.invoiceShowBankAccounts ?? true,
        invoiceCity: data.invoiceCity || null,
        invoiceAddress: data.invoiceAddress || null,
        invoicePhone: data.invoicePhone || null,
        invoiceEmail: data.invoiceEmail || null,
        bankAccounts: data.bankAccounts || [],
        sendPaymentReminders: data.sendPaymentReminders ?? false,
        reminderDaysBefore: data.reminderDaysBefore ?? 3,
        electronicProvider: data.electronicProvider || null,
        electronicProviderKey: data.electronicProviderKey || null,
        electronicProviderUrl: data.electronicProviderUrl || null,
      })
    } catch (err: any) {
      console.error('Error fetching settings:', err)
      setError(err.response?.data?.message || err.message || 'Error al cargar configuración')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSettings() }, [])

  const logoInputRef = useRef<HTMLInputElement>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    setSaved(false)
    try {
      const payload: any = {
        invoicePrefix: settings.invoicePrefix,
        receiptPrefix: settings.receiptPrefix,
        defaultLateFeeType: settings.defaultLateFeeType || undefined,
        defaultLateFeeValue: settings.defaultLateFeeValue ?? undefined,
        defaultGracePeriodDays: settings.defaultGracePeriodDays,
        billingMode: settings.billingMode,
        taxId: settings.taxId || undefined,
        businessName: settings.businessName || undefined,
        taxRegime: settings.taxRegime || undefined,
        ciiu: settings.ciiu || undefined,
        economicActivity: settings.economicActivity || undefined,
        invoiceResolution: settings.invoiceResolution || undefined,
        invoiceResolutionDate: settings.invoiceResolutionDate || undefined,
        invoiceResolutionPrefix: settings.invoiceResolutionPrefix || undefined,
        invoiceRangeFrom: settings.invoiceRangeFrom ?? undefined,
        invoiceRangeTo: settings.invoiceRangeTo ?? undefined,
        invoiceLogoUrl: settings.invoiceLogoUrl || undefined,
        invoicePageSize: settings.invoicePageSize,
        invoicePrimaryColor: settings.invoicePrimaryColor || undefined,
        invoiceSecondaryColor: settings.invoiceSecondaryColor || undefined,
        invoiceFooterText: settings.invoiceFooterText || undefined,
        invoiceShowQR: settings.invoiceShowQR,
        invoiceShowBankAccounts: settings.invoiceShowBankAccounts,
        invoiceCity: settings.invoiceCity || undefined,
        invoiceAddress: settings.invoiceAddress || undefined,
        invoicePhone: settings.invoicePhone || undefined,
        invoiceEmail: settings.invoiceEmail || undefined,
        bankAccounts: settings.bankAccounts,
        sendPaymentReminders: settings.sendPaymentReminders,
        reminderDaysBefore: settings.reminderDaysBefore,
        electronicProvider: settings.electronicProvider || undefined,
        electronicProviderKey: settings.electronicProviderKey || undefined,
        electronicProviderUrl: settings.electronicProviderUrl || undefined,
      }
      await financeSettingsApi.update(payload)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !settings || !institution?.id) return
    setUploadingLogo(true)
    try {
      const res = await storageApi.uploadGalleryImage(file, institution.id, 'invoice-logo')
      const url = res.data?.url || res.data?.publicUrl
      if (url) {
        setSettings({ ...settings, invoiceLogoUrl: url })
      }
    } catch (err: any) {
      alert('Error al subir logo: ' + (err.response?.data?.message || err.message))
    } finally {
      setUploadingLogo(false)
    }
  }

  const addBankAccount = () => {
    if (!settings) return
    setSettings({
      ...settings,
      bankAccounts: [...(settings.bankAccounts || []), { bankName: '', accountNumber: '', accountType: 'Ahorros', holderName: '' }],
    })
  }

  const removeBankAccount = (index: number) => {
    if (!settings) return
    const accounts = [...(settings.bankAccounts || [])]
    accounts.splice(index, 1)
    setSettings({ ...settings, bankAccounts: accounts })
  }

  const updateBankAccount = (index: number, field: keyof BankAccount, value: string) => {
    if (!settings) return
    const accounts = [...(settings.bankAccounts || [])]
    accounts[index] = { ...accounts[index], [field]: value }
    setSettings({ ...settings, bankAccounts: accounts })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="p-4 bg-red-100 rounded-full inline-block mb-4">
            <RefreshCw className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button onClick={fetchSettings} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  const toggleSection = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))

  if (!settings) return null

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm'
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

  const SectionCard = ({ id, icon: Icon, title, subtitle, children }: { id: string; icon: any; title: string; subtitle: string; children: React.ReactNode }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <button onClick={() => toggleSection(id)} className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg"><Icon className="w-5 h-5 text-blue-600" /></div>
          <div className="text-left">
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>
        </div>
        {openSections[id] ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
      </button>
      {openSections[id] && <div className="px-6 pb-6 border-t border-gray-100 pt-4">{children}</div>}
    </div>
  )

  const Toggle = ({ value, onChange, label, description }: { value: boolean; onChange: (v: boolean) => void; label: string; description?: string }) => (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
      <button onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-blue-500' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${value ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link to="/finance" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver a Finanzas
          </Link>
          <div className="flex items-center justify-between flex-wrap gap-y-2">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gray-200 rounded-xl">
                <SettingsIcon className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Configuraci&oacute;n Financiera</h1>
                <p className="text-gray-500 text-sm">Facturaci&oacute;n, datos fiscales, apariencia y notificaciones</p>
              </div>
            </div>
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 font-medium shadow-sm">
              <Save className="w-4 h-4" />
              {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar Cambios'}
            </button>
          </div>
        </div>

        {saved && (
          <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            Configuraci&oacute;n guardada correctamente
          </div>
        )}

        <div className="space-y-4">

          {/* ═══ MODO DE FACTURACIÓN ═══ */}
          <SectionCard id="billing" icon={FileText} title="Modo de Facturaci&oacute;n" subtitle="Tipo de documento y numeraci&oacute;n">
            {/* Billing Mode */}
            <div className="mb-5">
              <label className={labelCls}>Modo de facturaci&oacute;n</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                <label className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${settings.billingMode === 'INTERNAL_ONLY' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="billingMode" value="INTERNAL_ONLY" checked={settings.billingMode === 'INTERNAL_ONLY'}
                    onChange={() => setSettings({ ...settings, billingMode: 'INTERNAL_ONLY' })} className="sr-only" />
                  <p className="font-semibold text-gray-900 text-sm">Documento Interno</p>
                  <p className="text-xs text-gray-500 mt-1">Recibos y facturas internas. No requiere proveedor externo.</p>
                </label>
                <label className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${settings.billingMode === 'EXTERNAL_ELECTRONIC_PROVIDER' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="billingMode" value="EXTERNAL_ELECTRONIC_PROVIDER" checked={settings.billingMode === 'EXTERNAL_ELECTRONIC_PROVIDER'}
                    onChange={() => setSettings({ ...settings, billingMode: 'EXTERNAL_ELECTRONIC_PROVIDER' })} className="sr-only" />
                  <p className="font-semibold text-gray-900 text-sm">Proveedor Electr&oacute;nico</p>
                  <p className="text-xs text-gray-500 mt-1">Integraci&oacute;n con Siigo, Alegra, Loggro, etc. (Pr&oacute;ximamente)</p>
                </label>
              </div>
              {settings.billingMode === 'INTERNAL_ONLY' && (
                <p className="mt-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  Los documentos generados son para control interno. Para factura electr&oacute;nica v&aacute;lida ante la DIAN, consulte con su contador o active un proveedor electr&oacute;nico.
                </p>
              )}
            </div>

            {/* Numeración */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Prefijo de Facturas</label>
                <input type="text" value={settings.invoicePrefix} onChange={e => setSettings({ ...settings, invoicePrefix: e.target.value })} className={inputCls} />
                <p className="text-xs text-gray-400 mt-1">Ejemplo: FAC-000001</p>
              </div>
              <div>
                <label className={labelCls}>Prefijo de Recibos</label>
                <input type="text" value={settings.receiptPrefix} onChange={e => setSettings({ ...settings, receiptPrefix: e.target.value })} className={inputCls} />
                <p className="text-xs text-gray-400 mt-1">Ejemplo: REC-000001</p>
              </div>
            </div>

            {/* Mora */}
            <div className="mt-5 pt-5 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Configuraci&oacute;n de Mora</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Tipo de Mora</label>
                  <select value={settings.defaultLateFeeType || ''} onChange={e => setSettings({ ...settings, defaultLateFeeType: e.target.value || null })} className={inputCls}>
                    <option value="">Sin mora</option>
                    <option value="FIXED">Valor fijo</option>
                    <option value="PERCENTAGE">Porcentaje</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{settings.defaultLateFeeType === 'PERCENTAGE' ? 'Porcentaje (%)' : 'Valor ($)'}</label>
                  <input type="number" value={settings.defaultLateFeeValue ?? ''} onChange={e => setSettings({ ...settings, defaultLateFeeValue: e.target.value ? Number(e.target.value) : null })} className={inputCls} placeholder="0" />
                </div>
                <div>
                  <label className={labelCls}>D&iacute;as de gracia</label>
                  <input type="number" value={settings.defaultGracePeriodDays} onChange={e => setSettings({ ...settings, defaultGracePeriodDays: Number(e.target.value) || 0 })} className={inputCls} />
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ═══ DATOS FISCALES / DIAN ═══ */}
          <SectionCard id="fiscal" icon={Building2} title="Datos Fiscales e Institucionales" subtitle="NIT, raz&oacute;n social, r&eacute;gimen tributario y contacto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className={labelCls}>Raz&oacute;n Social</label>
                <input type="text" value={settings.businessName || ''} onChange={e => setSettings({ ...settings, businessName: e.target.value || null })} className={inputCls}
                  placeholder="Nombre legal completo de la instituci&oacute;n" />
              </div>
              <div>
                <label className={labelCls}>NIT</label>
                <input type="text" value={settings.taxId || ''} onChange={e => setSettings({ ...settings, taxId: e.target.value || null })} className={inputCls} placeholder="Ej: 900.123.456-7" />
              </div>
              <div>
                <label className={labelCls}>R&eacute;gimen Tributario</label>
                <select value={settings.taxRegime || ''} onChange={e => setSettings({ ...settings, taxRegime: e.target.value || null })} className={inputCls}>
                  <option value="">Seleccionar...</option>
                  <option value="RESPONSABLE_IVA">Responsable de IVA</option>
                  <option value="NO_RESPONSABLE">No Responsable de IVA</option>
                  <option value="REGIMEN_SIMPLE">R&eacute;gimen Simple de Tributaci&oacute;n</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>C&oacute;digo CIIU</label>
                <input type="text" value={settings.ciiu || ''} onChange={e => setSettings({ ...settings, ciiu: e.target.value || null })} className={inputCls} placeholder="Ej: 8521" />
              </div>
              <div>
                <label className={labelCls}>Actividad Econ&oacute;mica</label>
                <input type="text" value={settings.economicActivity || ''} onChange={e => setSettings({ ...settings, economicActivity: e.target.value || null })} className={inputCls} placeholder="Ej: Educaci&oacute;n b&aacute;sica secundaria" />
              </div>
            </div>

            <div className="mt-5 pt-5 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Datos de Contacto para Documentos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className={labelCls}>Direcci&oacute;n</label>
                  <input type="text" value={settings.invoiceAddress || ''} onChange={e => setSettings({ ...settings, invoiceAddress: e.target.value || null })} className={inputCls} placeholder="Calle 123 # 45-67" />
                </div>
                <div>
                  <label className={labelCls}>Ciudad</label>
                  <input type="text" value={settings.invoiceCity || ''} onChange={e => setSettings({ ...settings, invoiceCity: e.target.value || null })} className={inputCls} placeholder="Ej: Bogot&aacute; D.C." />
                </div>
                <div>
                  <label className={labelCls}>Tel&eacute;fono</label>
                  <input type="text" value={settings.invoicePhone || ''} onChange={e => setSettings({ ...settings, invoicePhone: e.target.value || null })} className={inputCls} placeholder="Ej: (601) 123-4567" />
                </div>
                <div>
                  <label className={labelCls}>Email Facturaci&oacute;n</label>
                  <input type="email" value={settings.invoiceEmail || ''} onChange={e => setSettings({ ...settings, invoiceEmail: e.target.value || null })} className={inputCls} placeholder="facturacion@colegio.edu.co" />
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ═══ APARIENCIA DEL DOCUMENTO ═══ */}
          <SectionCard id="visual" icon={Palette} title="Apariencia del Documento" subtitle="Logo, colores, tama&ntilde;o de p&aacute;gina y opciones visuales">
            {/* Logo */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">Logo / Escudo Institucional</label>
              <div className="flex items-center gap-4">
                {settings.invoiceLogoUrl ? (
                  <div className="relative">
                    <img src={settings.invoiceLogoUrl} alt="Logo factura" className="w-16 h-16 object-contain border border-gray-200 rounded-lg bg-white" />
                    <button onClick={() => setSettings({ ...settings, invoiceLogoUrl: null })}
                      className="absolute -top-2 -right-2 p-0.5 bg-red-500 text-white rounded-full hover:bg-red-600">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                    <Image className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <div>
                  <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  <button onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1 text-sm disabled:opacity-50">
                    <Upload className="w-4 h-4" /> {uploadingLogo ? 'Subiendo...' : 'Subir Logo'}
                  </button>
                  <p className="text-xs text-gray-400 mt-1">PNG o JPG. Se muestra en facturas y recibos.</p>
                </div>
              </div>
              <div className="mt-2">
                <label className="block text-xs text-gray-500 mb-1">O pegar URL directa:</label>
                <input type="text" value={settings.invoiceLogoUrl || ''} onChange={e => setSettings({ ...settings, invoiceLogoUrl: e.target.value || null })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" placeholder="https://..." />
              </div>
            </div>

            {/* Tamaño de página */}
            <div className="mb-5">
              <label className={labelCls}>Tama&ntilde;o de P&aacute;gina</label>
              <div className="flex gap-3 mt-1">
                <label className={`flex-1 p-3 border-2 rounded-lg cursor-pointer text-center transition-all ${settings.invoicePageSize === 'LETTER' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="pageSize" value="LETTER" checked={settings.invoicePageSize === 'LETTER'}
                    onChange={() => setSettings({ ...settings, invoicePageSize: 'LETTER' })} className="sr-only" />
                  <p className="font-semibold text-gray-900 text-sm">Carta</p>
                  <p className="text-xs text-gray-500">8.5&quot; &times; 11&quot;</p>
                </label>
                <label className={`flex-1 p-3 border-2 rounded-lg cursor-pointer text-center transition-all ${settings.invoicePageSize === 'HALF_LETTER' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="pageSize" value="HALF_LETTER" checked={settings.invoicePageSize === 'HALF_LETTER'}
                    onChange={() => setSettings({ ...settings, invoicePageSize: 'HALF_LETTER' })} className="sr-only" />
                  <p className="font-semibold text-gray-900 text-sm">Media Carta</p>
                  <p className="text-xs text-gray-500">5.5&quot; &times; 8.5&quot;</p>
                </label>
              </div>
            </div>

            {/* Colores */}
            <div className="mb-5">
              <label className={labelCls}>Colores del Documento</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1">
                <div className="flex items-center gap-3">
                  <input type="color" value={settings.invoicePrimaryColor || '#1E40AF'} onChange={e => setSettings({ ...settings, invoicePrimaryColor: e.target.value })}
                    className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Color Primario</p>
                    <p className="text-xs text-gray-500">Bordes, encabezados y barras</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input type="color" value={settings.invoiceSecondaryColor || '#F0F9FF'} onChange={e => setSettings({ ...settings, invoiceSecondaryColor: e.target.value })}
                    className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Color Secundario</p>
                    <p className="text-xs text-gray-500">Fondos alternos y resaltados</p>
                  </div>
                </div>
              </div>
              {/* Preview bar */}
              <div className="mt-3 flex gap-2 items-center">
                <div className="h-4 flex-1 rounded" style={{ backgroundColor: settings.invoicePrimaryColor || '#1E40AF' }} />
                <div className="h-4 flex-1 rounded" style={{ backgroundColor: settings.invoiceSecondaryColor || '#F0F9FF' }} />
                <span className="text-xs text-gray-400">Vista previa</span>
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <Toggle value={settings.invoiceShowQR} onChange={v => setSettings({ ...settings, invoiceShowQR: v })}
                label="Mostrar c&oacute;digo QR" description="QR con datos de verificaci&oacute;n del pago" />
              <Toggle value={settings.invoiceShowBankAccounts} onChange={v => setSettings({ ...settings, invoiceShowBankAccounts: v })}
                label="Mostrar cuentas bancarias" description="Incluir cuentas bancarias en el documento" />
            </div>

            {/* Pie de página */}
            <div className="mt-5 pt-5 border-t border-gray-100">
              <label className={labelCls}>Texto Legal / Pie de P&aacute;gina</label>
              <textarea value={settings.invoiceFooterText || ''} onChange={e => setSettings({ ...settings, invoiceFooterText: e.target.value || null })}
                className={inputCls} rows={3}
                placeholder="Ej: Esta factura se asimila en todos sus efectos a una letra de cambio seg&uacute;n Art. 774 del C&oacute;digo de Comercio..." />
            </div>
          </SectionCard>

          {/* ═══ RESOLUCIÓN DIAN ═══ */}
          <SectionCard id="resolution" icon={Shield} title="Resoluci&oacute;n de Facturaci&oacute;n (DIAN)" subtitle="Datos de autorizaci&oacute;n para facturaci&oacute;n. Solo si aplica.">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-xs mb-4">
              Estos datos son opcionales. Solo dil&iacute;gencielos si su instituci&oacute;n cuenta con resoluci&oacute;n de facturaci&oacute;n de la DIAN.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className={labelCls}>Resoluci&oacute;n</label>
                <input type="text" value={settings.invoiceResolution || ''} onChange={e => setSettings({ ...settings, invoiceResolution: e.target.value || null })} className={inputCls}
                  placeholder="Resoluci&oacute;n DIAN No. 18764000001234" />
              </div>
              <div>
                <label className={labelCls}>Fecha de Resoluci&oacute;n</label>
                <input type="date" value={settings.invoiceResolutionDate?.split('T')[0] || ''} onChange={e => setSettings({ ...settings, invoiceResolutionDate: e.target.value || null })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Prefijo Autorizado</label>
                <input type="text" value={settings.invoiceResolutionPrefix || ''} onChange={e => setSettings({ ...settings, invoiceResolutionPrefix: e.target.value || null })} className={inputCls} placeholder="Ej: SETT" />
              </div>
              <div>
                <label className={labelCls}>Numeraci&oacute;n Desde</label>
                <input type="number" value={settings.invoiceRangeFrom ?? ''} onChange={e => setSettings({ ...settings, invoiceRangeFrom: e.target.value ? Number(e.target.value) : null })} className={inputCls} placeholder="1" />
              </div>
              <div>
                <label className={labelCls}>Numeraci&oacute;n Hasta</label>
                <input type="number" value={settings.invoiceRangeTo ?? ''} onChange={e => setSettings({ ...settings, invoiceRangeTo: e.target.value ? Number(e.target.value) : null })} className={inputCls} placeholder="10000" />
              </div>
            </div>
          </SectionCard>

          {/* ═══ CUENTAS BANCARIAS ═══ */}
          <SectionCard id="bank" icon={CreditCard} title="Cuentas Bancarias" subtitle="Cuentas para recibir pagos. Se muestran en documentos.">
            <div className="flex justify-end mb-3">
              <button onClick={addBankAccount} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1 text-sm font-medium">
                <Plus className="w-4 h-4" /> Agregar Cuenta
              </button>
            </div>
            {(!settings.bankAccounts || settings.bankAccounts.length === 0) ? (
              <p className="text-gray-400 text-sm text-center py-4">No hay cuentas bancarias configuradas</p>
            ) : (
              <div className="space-y-3">
                {settings.bankAccounts.map((account, idx) => (
                  <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">Cuenta {idx + 1}</span>
                      <button onClick={() => removeBankAccount(idx)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input type="text" value={account.bankName} onChange={e => updateBankAccount(idx, 'bankName', e.target.value)} className={inputCls} placeholder="Banco" />
                      <input type="text" value={account.accountNumber} onChange={e => updateBankAccount(idx, 'accountNumber', e.target.value)} className={inputCls} placeholder="N&deg; Cuenta" />
                      <select value={account.accountType} onChange={e => updateBankAccount(idx, 'accountType', e.target.value)} className={inputCls}>
                        <option value="Ahorros">Ahorros</option>
                        <option value="Corriente">Corriente</option>
                      </select>
                      <input type="text" value={account.holderName} onChange={e => updateBankAccount(idx, 'holderName', e.target.value)} className={inputCls} placeholder="Titular" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* ═══ NOTIFICACIONES ═══ */}
          <SectionCard id="notifications" icon={Bell} title="Notificaciones" subtitle="Recordatorios autom&aacute;ticos de pago">
            <Toggle value={settings.sendPaymentReminders} onChange={v => setSettings({ ...settings, sendPaymentReminders: v })}
              label="Recordatorios de pago" description="Enviar recordatorio antes del vencimiento" />
            {settings.sendPaymentReminders && (
              <div className="mt-4">
                <label className={labelCls}>D&iacute;as antes del vencimiento</label>
                <input type="number" value={settings.reminderDaysBefore} onChange={e => setSettings({ ...settings, reminderDaysBefore: Number(e.target.value) || 3 })}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm" min={1} max={30} />
              </div>
            )}
          </SectionCard>

          {/* ═══ PROVEEDOR ELECTRÓNICO (FUTURO) ═══ */}
          {settings.billingMode === 'EXTERNAL_ELECTRONIC_PROVIDER' && (
            <SectionCard id="electronic" icon={Shield} title="Proveedor Electr&oacute;nico" subtitle="Configuraci&oacute;n de integraci&oacute;n con proveedor de facturaci&oacute;n electr&oacute;nica">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs mb-4">
                Esta funcionalidad estar&aacute; disponible pr&oacute;ximamente. Por ahora puede registrar los datos de su proveedor.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Proveedor</label>
                  <select value={settings.electronicProvider || ''} onChange={e => setSettings({ ...settings, electronicProvider: e.target.value || null })} className={inputCls}>
                    <option value="">Seleccionar...</option>
                    <option value="siigo">Siigo</option>
                    <option value="alegra">Alegra</option>
                    <option value="loggro">Loggro</option>
                    <option value="world_office">World Office</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>API Key</label>
                  <input type="password" value={settings.electronicProviderKey || ''} onChange={e => setSettings({ ...settings, electronicProviderKey: e.target.value || null })} className={inputCls} placeholder="API Key del proveedor" />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>URL del Proveedor</label>
                  <input type="text" value={settings.electronicProviderUrl || ''} onChange={e => setSettings({ ...settings, electronicProviderUrl: e.target.value || null })} className={inputCls} placeholder="https://api.proveedor.com/v1" />
                </div>
              </div>
            </SectionCard>
          )}

        </div>
      </div>
    </div>
  )
}
