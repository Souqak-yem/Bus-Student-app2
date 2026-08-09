import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Plus,
  Search,
  X,
  ChevronDown,
  Filter,
  Download,
  Copy,
  Check,
  Phone,
  MapPin,
} from "lucide-react";
import { api } from "../../lib/api";
import PageHeader from "../../components/ui/PageHeader";
import Section from "../../components/ui/Section";
import StatusBadge from "../../components/ui/StatusBadge";
import DataTable from "../../components/ui/DataTable";
import { SkeletonCard } from "../../components/ui/Skeleton";
import ResponsiveKpiGrid from '../../components/ui/ResponsiveKpiGrid'
import EmptyState from "../../components/ui/EmptyState";
import ConfirmModal from "../../components/ui/ConfirmModal";

const dayOptions = [
  { value: "SATURDAY", label: "السبت" },
  { value: "SUNDAY", label: "الأحد" },
  { value: "MONDAY", label: "الإثنين" },
  { value: "TUESDAY", label: "الثلاثاء" },
  { value: "WEDNESDAY", label: "الأربعاء" },
  { value: "THURSDAY", label: "الخميس" },
];

const emptyForm = {
  name: "",
  phone: "",
  whatsapp: "",
  parentName: "",
  parentRelation: "",
  parentPhone: "",
  address: "",
  zone: "",
  major: "",
  level: "",
  institutionName: "",
  offDays: [],
  pickupLocation: "",
  transportMode: "LINE",
  homeAddress: "",
  homeDeliveryFee: "",
  homeDeliveryFeeDaily: "",
  homeDeliveryFeeThreeWeeks: "",
  homeDeliveryFeeFourWeeks: "",
  homeNotes: "",
  homeDeliveryActive: false,
  destinationId: "",
};

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [pricingZones, setPricingZones] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [search, setSearch] = useState("");
  const [filterZone, setFilterZone] = useState("");
  const [filterDestinationId, setFilterDestinationId] = useState("");
  const [filterMode, setFilterMode] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [showConfirm, setShowConfirm] = useState(null);

  async function load() {
    try {
      const params = { search };
      if (filterZone) params.zone = filterZone;
      if (filterDestinationId) params.destinationId = filterDestinationId;
      if (filterMode) params.transportMode = filterMode;
      const [data, zones, dests] = await Promise.all([
        api.students.list(params),
        api.pricing.zones().catch(() => []),
        api.destinations.active().catch(() => []),
      ]);
      setStudents(data);
      setPricingZones(zones);
      setDestinations(dests);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [search, filterZone, filterDestinationId, filterMode]);

  function handleResetFilters() {
    setFilterZone("");
    setFilterDestinationId("");
    setFilterMode("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.transportMode === "LINE" && !form.pickupLocation?.trim()) {
      return alert("يرجى إدخال نقطة الانتظار للطلاب على الخط العام");
    }
    if (form.transportMode === "HOME" && !form.homeAddress?.trim()) {
      return alert("يرجى إدخال عنوان المنزل للتوصيل المنزلي");
    }
    try {
      const payload = { ...form };
      if (payload.transportMode === "LINE") {
        payload.homeAddress = "";
        payload.homeDeliveryFee = 0;
        payload.homeDeliveryFeeDaily = 0;
        payload.homeDeliveryFeeThreeWeeks = 0;
        payload.homeDeliveryFeeFourWeeks = 0;
        payload.homeNotes = "";
        payload.homeDeliveryActive = false;
      } else {
        payload.homeDeliveryFee = Number(payload.homeDeliveryFee) || 0;
        payload.homeDeliveryFeeDaily = Number(payload.homeDeliveryFeeDaily) || 0;
        payload.homeDeliveryFeeThreeWeeks = Number(payload.homeDeliveryFeeThreeWeeks) || 0;
        payload.homeDeliveryFeeFourWeeks = Number(payload.homeDeliveryFeeFourWeeks) || 0;
      }
      if (editing) {
        await api.students.update(editing, payload);
        setForm(emptyForm);
        setEditing(null);
        setShowForm(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } else {
        const result = await api.students.create(payload);
        setForm(emptyForm);
        setEditing(null);
        setShowForm(false);
        if (result.credentials) {
          setCredentials(result.credentials);
        } else {
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 2000);
        }
      }
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  function handleEdit(s) {
    const addressValue = s.address || "";
    const pickupValue = s.pickupLocation || addressValue;
    setForm({
      name: s.name,
      phone: s.phone || "",
      whatsapp: s.whatsapp || "",
      parentName: s.parentName || "",
      parentRelation: s.parentRelation || "",
      parentPhone: s.parentPhone || "",
      address: addressValue,
      zone: s.zone || "",
      destinationId: s.destinationId || "",
      major: s.major || "",
      level: s.level || "",
      institutionName: s.institutionName || "",
      offDays: s.offDays || [],
      pickupLocation: pickupValue,
      transportMode: s.transportMode || "LINE",
      homeAddress: s.homeAddress || "",
      homeDeliveryFee: s.homeDeliveryFee ? String(s.homeDeliveryFee) : "",
      homeDeliveryFeeDaily: s.homeDeliveryFeeDaily ? String(s.homeDeliveryFeeDaily) : "",
      homeDeliveryFeeThreeWeeks: s.homeDeliveryFeeThreeWeeks ? String(s.homeDeliveryFeeThreeWeeks) : "",
      homeDeliveryFeeFourWeeks: s.homeDeliveryFeeFourWeeks ? String(s.homeDeliveryFeeFourWeeks) : "",
      homeNotes: s.homeNotes || "",
      homeDeliveryActive: s.homeDeliveryActive || false,
    });
    setEditing(s.id);
    setShowForm(true);
  }

  async function handleDelete(id) {
    setShowConfirm(id)
  }

  async function handleConfirmed() {
    const id = showConfirm
    setShowConfirm(null)
    try {
      await api.students.delete(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  function handleCancel() {
    setForm(emptyForm);
    setEditing(null);
    setShowForm(false);
  }

  const columns = [
    {
      key: "name",
      label: "الاسم",
      render: (r) => <span className="font-medium">{r.name}</span>,
    },
    { key: "major", label: "التخصص", hideOnMobile: true },
    { key: "level", label: "المستوى", hideOnMobile: true },
    {
      key: "transportMode",
      label: "التوصيل",
      hideOnMobile: true,
      render: (r) => (
        <StatusBadge status={r.transportMode === "HOME" ? "home" : "line"} />
      ),
    },
    { key: "phone", label: "الجوال", hideOnMobile: true },
    { key: "parentName", label: "ولي الأمر", hideOnMobile: true },
    { key: "zone", label: "المنطقة", hideOnMobile: true },
    {
      key: "destination",
      label: "الوجهة",
      hideOnMobile: true,
      render: (r) => r.destination?.name || "-",
    },
    {
      key: "status",
      label: "الحالة",
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleEdit(r)}
            className="btn-ghost btn-sm text-xs"
          >
            تعديل
          </button>
          <button
            onClick={() => handleDelete(r.id)}
            className="btn-ghost btn-sm text-xs text-[var(--color-danger)]"
          >
            حذف
          </button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div>
        <PageHeader title="الطلاب" subtitle="إدارة بيانات الطلاب" />
        <ResponsiveKpiGrid>
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </ResponsiveKpiGrid>
        <div className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] p-4 sm:p-6 mt-6">
          <div className="space-y-3">
            <div className="skeleton h-10 w-full rounded-xl" />
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="skeleton h-12 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="الطلاب" subtitle="إدارة بيانات الطلاب">
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus size={16} />
          إضافة طالب
        </button>
      </PageHeader>

      <div className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] p-4 mb-4">
        <div className="grid gap-3 lg:grid-cols-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-2">المنطقة</label>
            <select
              value={filterZone}
              onChange={(e) => setFilterZone(e.target.value)}
              className="w-full input-field"
            >
              <option value="">الكل</option>
              {pricingZones.map((zone) => (
                <option key={zone.id} value={zone.name}>{zone.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-2">الوجهة</label>
            <select
              value={filterDestinationId}
              onChange={(e) => setFilterDestinationId(e.target.value)}
              className="w-full input-field"
            >
              <option value="">الكل</option>
              {destinations.map((dest) => (
                <option key={dest.id} value={dest.id}>{dest.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-2">نوع التوصيل</label>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="w-full input-field"
            >
              <option value="">الكل</option>
              <option value="LINE">توصيل على الخط</option>
              <option value="HOME">توصيل منزلي</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleResetFilters}
              className="btn-ghost btn-sm w-full"
            >
              إعادة الكل
            </button>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={students}
        mobileCards
        searchPlaceholder="بحث باسم الطالب أو رقم الجوال..."
        emptyTitle="لا يوجد طلاب"
        emptyDescription="لم يتم إضافة أي طالب بعد. أضف طالباً جديداً للبدء."
        emptyAction={() => setShowForm(true)}
        emptyActionText="إضافة طالب"
        onRowClick={(row) => handleEdit(row)}
        renderRow={(row, visibleCols) => (
          <>
            {visibleCols.map(col => (
              <td key={col.key} className="max-sm:hidden px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm border-b border-[var(--color-border-light)]">
                {col.render ? col.render(row) : row[col.key] ?? '-'}
              </td>
            ))}
            <td className="sm:hidden block p-0 border-0">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{row.name}</span>
                  <StatusBadge status={row.status} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-muted)]">
                  {row.phone && <span className="flex items-center gap-1"><Phone size={10} /> {row.phone}</span>}
                  {row.transportMode && <StatusBadge status={row.transportMode === 'HOME' ? 'home' : 'line'} />}
                  {row.zone && <span className="flex items-center gap-1"><MapPin size={10} /> {row.zone}</span>}
                  {row.destination?.name && <span className="flex items-center gap-1"><MapPin size={10} /> {row.destination.name}</span>}
                </div>
                <div className="flex gap-1">
                  <button onClick={(e) => { e.stopPropagation(); handleEdit(row) }} className="btn-ghost btn-sm text-xs">تعديل</button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(row.id) }} className="btn-ghost btn-sm text-xs text-[var(--color-danger)]">حذف</button>
                </div>
              </div>
            </td>
          </>
        )}
      />

      {/* Student Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={handleCancel}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="modal-content max-w-[min(95vw,1160px)] lg:max-w-[1200px]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
                <h2 className="text-lg font-bold">
                  {editing ? "تعديل طالب" : "إضافة طالب جديد"}
                </h2>
                <button
                  onClick={handleCancel}
                  className="p-2 rounded-lg hover:bg-[var(--color-border-light)]"
                >
                  <X size={20} />
                </button>
              </div>

              {saveSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mx-6 mt-4 px-4 py-3 rounded-xl bg-[var(--color-success-light)] text-green-700 text-sm font-medium"
                >
                  تم حفظ البيانات بنجاح
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Basic Info */}
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3 pb-2 border-b border-[var(--color-border-light)]">
                    المعلومات الأساسية
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="الاسم" required>
                      <input
                        value={form.name}
                        onChange={(e) =>
                          setForm({ ...form, name: e.target.value })
                        }
                        className="input-field"
                        required
                      />
                    </FormField>
                    <FormField label="رقم الجوال">
                      <input
                        value={form.phone}
                        onChange={(e) =>
                          setForm({ ...form, phone: e.target.value })
                        }
                        className="input-field"
                      />
                    </FormField>
                    <FormField label="الواتساب">
                      <input
                        value={form.whatsapp}
                        onChange={(e) =>
                          setForm({ ...form, whatsapp: e.target.value })
                        }
                        className="input-field"
                      />
                    </FormField>
                    <FormField label="المنطقة">
                      <select
                        value={form.zone}
                        onChange={(e) =>
                          setForm({ ...form, zone: e.target.value })
                        }
                        className="select-field"
                        disabled={pricingZones.length === 0}
                      >
                        <option value="">
                          {pricingZones.length > 0
                            ? "اختر المنطقة"
                            : "لا توجد مناطق مسجلة"}
                        </option>
                        {pricingZones.map((zone) => (
                          <option key={zone.id} value={zone.name}>
                            {zone.name}
                          </option>
                        ))}
                        {form.zone &&
                        !pricingZones.some((zone) => zone.name === form.zone) ? (
                          <option value={form.zone}>{form.zone}</option>
                        ) : null}
                      </select>
                    </FormField>
                    <FormField label="الوجهة">
                      <select
                        value={form.destinationId}
                        onChange={(e) =>
                          setForm({ ...form, destinationId: e.target.value })
                        }
                        className="select-field"
                      >
                        <option value="">اختر الوجهة</option>
                        {destinations.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="التخصص">
                      <input
                        value={form.major}
                        onChange={(e) =>
                          setForm({ ...form, major: e.target.value })
                        }
                        className="input-field"
                      />
                    </FormField>
                    <FormField label="المستوى">
                      <input
                        value={form.level}
                        onChange={(e) =>
                          setForm({ ...form, level: e.target.value })
                        }
                        className="input-field"
                      />
                    </FormField>
                    <FormField label="العنوان" className="sm:col-span-2">
                      <input
                        value={form.address}
                        onChange={(e) => {
                          const newAddress = e.target.value;
                          setForm({
                            ...form,
                            address: newAddress,
                            pickupLocation:
                              !form.pickupLocation || form.pickupLocation === form.address
                                ? newAddress
                                : form.pickupLocation,
                          });
                        }}
                        className="input-field"
                      />
                    </FormField>
                  </div>
                </div>

                {/* Parent Info */}
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3 pb-2 border-b border-[var(--color-border-light)]">
                    معلومات ولي الأمر
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="اسم ولي الأمر">
                      <input
                        value={form.parentName}
                        onChange={(e) =>
                          setForm({ ...form, parentName: e.target.value })
                        }
                        className="input-field"
                      />
                    </FormField>
                    <FormField label="جوال ولي الأمر">
                      <input
                        value={form.parentPhone}
                        onChange={(e) =>
                          setForm({ ...form, parentPhone: e.target.value })
                        }
                        className="input-field"
                      />
                    </FormField>
                    <FormField label="القرابة">
                      <input
                        value={form.parentRelation}
                        onChange={(e) =>
                          setForm({ ...form, parentRelation: e.target.value })
                        }
                        className="input-field"
                        placeholder="أب / أم / ولي"
                      />
                    </FormField>
                  </div>
                </div>



                {/* Off Days */}
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3 pb-2 border-b border-[var(--color-border-light)]">
                    أيام الإجازة
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {dayOptions.map((d) => (
      <label
        key={d.value}
        className="flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-lg cursor-pointer transition-colors text-sm border border-[var(--color-border)] hover:bg-[var(--color-border-light)] has-checked:bg-[var(--color-primary-lighter)] has-checked:border-[var(--color-primary)] has-checked:text-[var(--color-primary-dark)]"
      >
                        <input
                          type="checkbox"
                          checked={form.offDays?.includes(d.value)}
                          onChange={() =>
                            setForm({
                              ...form,
                              offDays: form.offDays?.includes(d.value)
                                ? form.offDays.filter((x) => x !== d.value)
                                : [...(form.offDays || []), d.value],
                            })
                          }
                          className="sr-only"
                        />
                        {d.label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Transport Mode */}
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3 pb-2 border-b border-[var(--color-border-light)]">
                    نوع التوصيل
                  </h3>
                  <div className="flex gap-3">
                    <TransportModeCard
                      selected={form.transportMode === "LINE"}
                      value="LINE"
                      label="توصيل على الخط"
                      desc="نقطة تجميع ثابتة"
                      onClick={() =>
                        setForm({ ...form, transportMode: "LINE" })
                      }
                    />
                    <TransportModeCard
                      selected={form.transportMode === "HOME"}
                      value="HOME"
                      label="توصيل منزلي"
                      desc="توصيل إلى باب المنزل"
                      onClick={() =>
                        setForm({ ...form, transportMode: "HOME" })
                      }
                    />
                  </div>

                  {form.transportMode === "LINE" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-3 p-4 rounded-xl bg-blue-50 border border-blue-200"
                    >
                      <FormField label="نقطة الانتظار" required>
                        <input
                          value={form.pickupLocation}
                          onChange={(e) =>
                            setForm({ ...form, pickupLocation: e.target.value })
                          }
                          className="input-field"
                          placeholder="نقطة التجميع على الخط"
                        />
                      </FormField>
                    </motion.div>
                  )}

                  {form.transportMode === "HOME" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-3 p-4 rounded-xl bg-orange-50 border border-orange-200 space-y-3"
                    >
                      <FormField label="عنوان المنزل" required>
                        <input
                          value={form.homeAddress}
                          onChange={(e) =>
                            setForm({ ...form, homeAddress: e.target.value })
                          }
                          className="input-field"
                          placeholder="شارع، حي، رقم المنزل"
                        />
                      </FormField>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField label="رسوم التوصيل - يومي">
                          <input
                            type="number"
                            value={form.homeDeliveryFeeDaily}
                            onChange={(e) =>
                              setForm({ ...form, homeDeliveryFeeDaily: e.target.value })
                            }
                            className="input-field"
                            placeholder="0"
                          />
                        </FormField>
                        <FormField label="رسوم التوصيل - ٣ أسابيع">
                          <input
                            type="number"
                            value={form.homeDeliveryFeeThreeWeeks}
                            onChange={(e) =>
                              setForm({ ...form, homeDeliveryFeeThreeWeeks: e.target.value })
                            }
                            className="input-field"
                            placeholder="0"
                          />
                        </FormField>
                        <FormField label="رسوم التوصيل - ٤ أسابيع">
                          <input
                            type="number"
                            value={form.homeDeliveryFeeFourWeeks}
                            onChange={(e) =>
                              setForm({ ...form, homeDeliveryFeeFourWeeks: e.target.value })
                            }
                            className="input-field"
                            placeholder="0"
                          />
                        </FormField>
                        <div className="flex items-end pb-1">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={form.homeDeliveryActive}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  homeDeliveryActive: e.target.checked,
                                })
                              }
                              className="w-4 h-4 text-[var(--color-primary)] rounded"
                            />
                            <span className="text-sm">التوصيل المنزلي نشط</span>
                          </label>
                        </div>
                      </div>
                      <FormField label="ملاحظات السائق">
                        <input
                          value={form.homeNotes}
                          onChange={(e) =>
                            setForm({ ...form, homeNotes: e.target.value })
                          }
                          className="input-field"
                          placeholder="مدخل خاص، تعليمات الوصول..."
                        />
                      </FormField>
                    </motion.div>
                  )}
                </div>

                {/* Submit */}
                <div className="flex gap-2 pt-3 border-t border-[var(--color-border)] sticky bottom-0 bg-white -mx-3 sm:-mx-6 px-3 sm:px-6 pb-0 max-sm:pb-[80px] mt-5">
                  <button type="submit" className="btn-primary btn-lg flex-1 sm:flex-none justify-center">
                    {editing ? "حفظ التعديلات" : "إضافة الطالب"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="btn-ghost btn-lg flex-1 sm:flex-none justify-center"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Credentials Dialog */}
      {credentials && (
        <div className="modal-overlay" onClick={() => setCredentials(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="modal-content max-w-sm p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Check size={24} className="text-white" />
            </div>
            <h3 className="text-lg font-bold mb-1">تم إنشاء الحساب بنجاح</h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              تم إنشاء حساب للطالب تلقائياً
            </p>
            <div className="bg-[var(--color-border-light)] rounded-xl p-4 mb-4 text-right">
              <div className="mb-3">
                <p className="text-xs text-[var(--color-text-muted)] mb-0.5">
                  اسم المستخدم
                </p>
                <p className="text-lg font-bold font-mono" dir="ltr">
                  {credentials.username}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)] mb-0.5">
                  كلمة المرور المؤقتة
                </p>
                <p
                  className="text-lg font-bold font-mono text-[var(--color-accent)]"
                  dir="ltr"
                >
                  {credentials.password}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `اسم المستخدم: ${credentials.username}\nكلمة المرور: ${credentials.password}`,
                  );
                  setCredentials(null);
                }}
                className="btn-ghost flex-1 justify-center text-sm"
              >
                <Copy size={14} /> نسخ
              </button>
              <button
                onClick={() => window.print()}
                className="btn-ghost flex-1 justify-center text-sm hidden print:hidden"
              >
                طباعة
              </button>
              <button
                onClick={() => setCredentials(null)}
                className="btn-primary flex-1 justify-center text-sm"
              >
                تم
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <ConfirmModal
        show={!!showConfirm}
        onClose={() => setShowConfirm(null)}
        onConfirm={handleConfirmed}
        title="تأكيد حذف الطالب"
        danger
      >
        هل أنت متأكد من حذف هذا الطالب؟
      </ConfirmModal>
    </div>
  );
}

function FormField({ label, required, children, className = "" }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
        {label}
        {required && (
          <span className="text-[var(--color-danger)] mr-0.5">*</span>
        )}
      </label>
      {children}
    </div>
  );
}

function TransportModeCard({ selected, label, desc, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 p-4 rounded-xl border-2 text-right transition-all ${
        selected
          ? "border-[var(--color-primary)] bg-[var(--color-primary-lighter)]"
          : "border-[var(--color-border)] hover:border-[var(--color-primary-light)]"
      }`}
    >
      <p
        className={`font-medium text-sm ${selected ? "text-[var(--color-primary-dark)]" : ""}`}
      >
        {label}
      </p>
      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{desc}</p>
    </button>
  );
}
