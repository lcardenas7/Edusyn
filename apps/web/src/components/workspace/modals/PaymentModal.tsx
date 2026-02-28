import { Check } from 'lucide-react'
import { WModal, WButton, WInput } from '../ui'

interface PaymentModalProps {
  open: boolean
  onClose: () => void
  title: string
  currentAmount: number
  perStudent: number
  payAmount: string
  onPayAmountChange: (value: string) => void
  onPayFull: () => void
  onPayCustom: () => void
}

export default function PaymentModal({
  open,
  onClose,
  title,
  currentAmount,
  perStudent,
  payAmount,
  onPayAmountChange,
  onPayFull,
  onPayCustom,
}: PaymentModalProps) {
  return (
    <WModal
      open={open}
      onClose={onClose}
      title="Registrar pago"
      subtitle={title}
      size="sm"
      footer={
        <>
          <WButton variant="ghost" onClick={onClose}>Cancelar</WButton>
          <WButton
            variant="primary"
            onClick={onPayFull}
            disabled={!perStudent}
            className="bg-green-600 hover:bg-green-700"
            icon={<Check className="w-3.5 h-3.5" />}
          >
            Pago completo
          </WButton>
          <WButton
            onClick={onPayCustom}
            disabled={!payAmount || Number(payAmount) <= 0}
          >
            Confirmar monto
          </WButton>
        </>
      }
    >
      {perStudent > 0 && (
        <p className="text-body-sm text-slate-400">
          Valor esperado: <span className="font-medium text-slate-600">${perStudent.toLocaleString()}</span>
        </p>
      )}
      <WInput
        label="Monto pagado ($)"
        type="number"
        value={payAmount}
        onChange={(e) => onPayAmountChange(e.target.value)}
        placeholder={String(perStudent || 0)}
        min={0}
        autoFocus
        onKeyDown={(e) => { if (e.key === 'Enter') onPayCustom() }}
      />
      {currentAmount > 0 && (
        <p className="text-body-sm text-amber-600">Pago anterior: ${currentAmount.toLocaleString()} (se reemplazará)</p>
      )}
    </WModal>
  )
}
