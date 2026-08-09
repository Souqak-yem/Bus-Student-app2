import Modal from './Modal'

export default function ConfirmModal({ show, onClose, onConfirm, title, children, confirmText = 'تأكيد', cancelText = 'إلغاء', loading, danger }) {
  return (
    <Modal
      show={show}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 text-white active:scale-[0.98] ${
              danger
                ? 'gradient-danger shadow-[0_4px_12px_-4px_rgba(239,68,68,0.5)]'
                : 'gradient-primary shadow-[0_4px_12px_-4px_rgba(37,99,235,0.5)]'
            }`}
          >
            {loading ? 'جاري...' : confirmText}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 transition-colors"
          >
            {cancelText}
          </button>
        </div>
      }
    >
      <div className="text-sm text-gray-600 leading-relaxed">
        {children}
      </div>
    </Modal>
  )
}
