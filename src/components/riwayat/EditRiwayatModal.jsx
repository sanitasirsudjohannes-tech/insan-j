import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { CHECKLIST_ITEMS, LOKASI_OPTIONS } from '../../lib/constants';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

export default function EditRiwayatModal({ isOpen, onClose, item, onSuccess }) {
  const [editFormData, setEditFormData] = useState({});
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen && item) {
      const fetchDetails = async () => {
        setIsLoading(true);
        try {
          const fields = CHECKLIST_ITEMS[item.formId] || [];
          const columns = ['id', ...fields.map(f => f.dbCol)].join(', ');

          const { data, error } = await supabase
            .from(item.tableName)
            .select(columns)
            .eq('id', item.originalId)
            .single();

          if (error) throw new Error(error.message);

          const formData = {
            _tanggal: item.tanggal,
            _lokasi: item.lokasi
          };

          fields.forEach(field => {
            formData[field.id] = data[field.dbCol] || 0;
          });

          setEditFormData(formData);
        } catch (err) {
          console.error(err);
          MySwal.fire('Error', 'Gagal memuat detail data. ' + err.message, 'error');
          onClose(); // close modal on error
        } finally {
          setIsLoading(false);
        }
      };

      fetchDetails();
    } else {
      setEditFormData({});
    }
  }, [isOpen, item, onClose]);

  const handleEditInputChange = (fieldId, value) => {
    if (fieldId === '_tanggal' || fieldId === '_lokasi') {
      setEditFormData(prev => ({
        ...prev,
        [fieldId]: value
      }));
      return;
    }

    let numStr = value.replace(/[^0-9]/g, '');
    let num = parseInt(numStr || '0', 10);
    if (num > 10) num = 10;
    if (num < 0) num = 0;

    setEditFormData(prev => ({
      ...prev,
      [fieldId]: num
    }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();

    const confirm = await MySwal.fire({
      title: 'Simpan Perubahan?',
      text: "Data nilai lama akan ditimpa dengan yang baru.",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Ya, Simpan!'
    });

    if (!confirm.isConfirmed) return;

    setIsSubmittingEdit(true);

    try {
      const items = CHECKLIST_ITEMS[item.formId] || [];

      let totalNilai = 0;
      let maksimalNilai = items.length * 10;
      let updateData = {};

      items.forEach(field => {
        const val = editFormData[field.id] || 0;
        totalNilai += val;
        updateData[field.dbCol] = val; // Set ke kolom DB yang benar
      });

      const persentase = maksimalNilai > 0 ? Math.round((totalNilai / maksimalNilai) * 100) : 0;

      // Update nilai agregat
      updateData.total = totalNilai;
      updateData.persen = persentase;

      if (editFormData._tanggal) {
        updateData.tanggal_pemeriksaan = editFormData._tanggal;
      }
      if (editFormData._lokasi) {
        updateData.ruangan = editFormData._lokasi;
      }

      const { error } = await supabase
        .from(item.tableName)
        .update(updateData)
        .eq('id', item.originalId);

      if (error) throw new Error(error.message);

      MySwal.fire('Berhasil', 'Data berhasil diperbarui!', 'success');
      onSuccess(); // Refresh data in parent
      onClose();   // Close modal

    } catch (error) {
      console.error(error);
      MySwal.fire('Error', 'Gagal menyimpan perubahan. ' + error.message, 'error');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-100 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col my-auto animation-fade-in-up">

        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-blue-600 text-white rounded-t-2xl">
          <h3 className="text-xl font-bold flex items-center">
            <i className="fas fa-edit mr-3"></i>
            Edit {item.formName}
          </h3>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 focus:outline-none p-1"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10">
              <i className="fas fa-circle-notch fa-spin text-3xl text-blue-500 mb-3"></i>
              <p className="text-gray-500 font-bold">Memuat detail form...</p>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 p-4 rounded-xl mb-6 flex flex-col sm:flex-row gap-4 border border-blue-100">
                <div className="flex-1">
                  <label className="font-semibold text-blue-900 block text-xs uppercase opacity-70 mb-1">LOKASI</label>
                  <input
                    type="text"
                    value={editFormData._lokasi || ''}
                    onChange={e => handleEditInputChange('_lokasi', e.target.value)}
                    list="lokasiListEdit"
                    className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                    placeholder="Ketik atau pilih lokasi"
                    required
                  />
                  <datalist id="lokasiListEdit">
                    {LOKASI_OPTIONS.map(opt => <option key={opt} value={opt} />)}
                  </datalist>
                </div>
                <div className="flex-1">
                  <label className="font-semibold text-blue-900 block text-xs uppercase opacity-70 mb-1">TANGGAL</label>
                  <input
                    type="date"
                    value={editFormData._tanggal || ''}
                    onChange={e => handleEditInputChange('_tanggal', e.target.value)}
                    className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                    required
                  />
                </div>
              </div>

              <form id="editForm" onSubmit={handleEditSubmit} className="space-y-4">
                {CHECKLIST_ITEMS[item.formId]?.map(checklistFieldItem => (
                  <div key={checklistFieldItem.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                    <label htmlFor={`edit_${checklistFieldItem.id}`} className="text-gray-700 flex-1 sm:mr-4 text-sm font-medium mb-2 sm:mb-0">
                      {checklistFieldItem.text}
                    </label>
                    <div className="flex items-center space-x-2 w-full sm:w-auto mt-2 sm:mt-0 justify-end">
                      <input
                        type="text"
                        inputMode="numeric"
                        className="w-16 text-center text-lg font-bold border-2 border-gray-200 rounded-lg py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                        id={`edit_${checklistFieldItem.id}`}
                        value={editFormData[checklistFieldItem.id] ?? ''}
                        onChange={(e) => handleEditInputChange(checklistFieldItem.id, e.target.value)}
                        required
                      />
                      <span className="text-gray-400 text-xs font-semibold whitespace-nowrap min-w-[40px] text-left">/ 10</span>
                    </div>
                  </div>
                ))}
              </form>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
          >
            Batal
          </button>
          <button
            type="submit"
            form="editForm"
            disabled={isSubmittingEdit || isLoading}
            className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmittingEdit ? (
              <><i className="fas fa-spinner fa-spin mr-2"></i>Menyimpan...</>
            ) : (
              <><i className="fas fa-save mr-2"></i>Simpan Perubahan</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
