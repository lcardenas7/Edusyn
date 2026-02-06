import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Settings as SettingsIcon, Save, RefreshCw, Plus, Trash2 } from 'lucide-react'
import { financeSettingsApi } from '../../lib/api'

interface BankAccount {
  bankName: string
  accountNumber: string
  accountType: string
  holderName: string
}

interface FinancialSettingsData {
  invoicePrefix: string
  receiptPrefix: string
  defaultLateFeeType: string | null
  defaultLateFeeValue: number | null
  defaultGracePeriodDays: number
  taxId: string | null
  taxRegime: string | null
  bankAccounts: BankAccount[] | null
  sendPaymentReminders: boolean
  reminderDaysBefore: number
}

export default function FinanceSettings() {
  const [settings, setSettings] = useState<FinancialSettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const response = await financeSettingsApi.get()
      setSettings(response.data)
    } catch (err) {
      console.error('Error fetching settings:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSettings() }, [])

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
        taxId: settings.taxId || undefined,
        taxRegime: settings.taxRegime || undefined,
        bankAccounts: settings.bankAccounts,
        sendPaymentReminders: settings.sendPaymentReminders,
        reminderDaysBefore: settings.reminderDaysBefore,
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

  if (!settings) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link to="/finance" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver a Finanzas
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gray-200 rounded-xl">
                <SettingsIcon className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Configuración Financiera</h1>
                <p className="text-gray-500">Numeración, mora, cuentas bancarias y notificaciones</p>
              </div>
            </div>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2 disabled:opacity-50">
              <Save className="w-4 h-4" />
              {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar Cambios'}
            </button>
          </div>
        </div>

        {saved && (
          <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            Configuración guardada correctamente
          </div>
        )}

        <div className="space-y-6">
          {/* Numeración */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Numeración</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prefijo de Facturas</label>
                <input type="text" value={settings.invoicePrefix} onChange={e => setSettings({ ...settings, invoicePrefix: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                <p className="text-xs text-gray-400 mt-1">Ejemplo: FAC-000001</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prefijo de Recibos</label>
                <input type="text" value={settings.receiptPrefix} onChange={e => setSettings({ ...settings, receiptPrefix: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                <p className="text-xs text-gray-400 mt-1">Ejemplo: REC-000001</p>
              </div>
            </div>
          </div>

          {/* Mora */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuración de Mora</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Mora</label>
                <select value={settings.defaultLateFeeType || ''} onChange={e => setSettings({ ...settings, defaultLateFeeType: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="">Sin mora</option>
                  <option value="FIXED">Valor fijo</option>
                  <option value="PERCENTAGE">Porcentaje</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {settings.defaultLateFeeType === 'PERCENTAGE' ? 'Porcentaje (%)' : 'Valor ($)'}
                </label>
                <input type="number" value={settings.defaultLateFeeValue ?? ''} onChange={e => setSettings({ ...settings, defaultLateFeeValue: e.target.value ? Number(e.target.value) : null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Días de gracia</label>
                <input type="number" value={settings.defaultGracePeriodDays} onChange={e => setSettings({ ...settings, defaultGracePeriodDays: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
            </div>
          </div>

          {/* Datos Fiscales */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Datos Fiscales</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NIT</label>
                <input type="text" value={settings.taxId || ''} onChange={e => setSettings({ ...settings, taxId: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="NIT para facturación" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Régimen Tributario</label>
                <select value={settings.taxRegime || ''} onChange={e => setSettings({ ...settings, taxRegime: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="">No aplica</option>
                  <option value="SIMPLIFICADO">Simplificado</option>
                  <option value="COMUN">Común</option>
                  <option value="NO_RESPONSABLE">No responsable de IVA</option>
                </select>
              </div>
            </div>
          </div>

          {/* Cuentas Bancarias */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Cuentas Bancarias</h2>
              <button onClick={addBankAccount} className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-1 text-sm">
                <Plus className="w-4 h-4" /> Agregar
              </button>
            </div>
            {(!settings.bankAccounts || settings.bankAccounts.length === 0) ? (
              <p className="text-gray-400 text-sm">No hay cuentas bancarias configuradas</p>
            ) : (
              <div className="space-y-4">
                {settings.bankAccounts.map((account, idx) => (
                  <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">Cuenta {idx + 1}</span>
                      <button onClick={() => removeBankAccount(idx)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input type="text" value={account.bankName} onChange={e => updateBankAccount(idx, 'bankName', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Banco" />
                      <input type="text" value={account.accountNumber} onChange={e => updateBankAccount(idx, 'accountNumber', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="N° Cuenta" />
                      <select value={account.accountType} onChange={e => updateBankAccount(idx, 'accountType', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                        <option value="Ahorros">Ahorros</option>
                        <option value="Corriente">Corriente</option>
                      </select>
                      <input type="text" value={account.holderName} onChange={e => updateBankAccount(idx, 'holderName', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Titular" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notificaciones */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notificaciones</h2>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-medium text-gray-700">Recordatorios de pago</p>
                <p className="text-sm text-gray-500">Enviar recordatorio antes del vencimiento</p>
              </div>
              <button onClick={() => setSettings({ ...settings, sendPaymentReminders: !settings.sendPaymentReminders })}
                className={`relative w-12 h-6 rounded-full transition-colors ${settings.sendPaymentReminders ? 'bg-blue-500' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${settings.sendPaymentReminders ? 'translate-x-6' : ''}`} />
              </button>
            </div>
            {settings.sendPaymentReminders && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Días antes del vencimiento</label>
                <input type="number" value={settings.reminderDaysBefore} onChange={e => setSettings({ ...settings, reminderDaysBefore: Number(e.target.value) || 3 })}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg" min={1} max={30} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
