import React, { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

type Product = {
  name: string
  minRate?: number | null
  maxRate?: number | null
  eiqPerHa?: number | null
}

type Row = {
  id: string
  product?: string
  times: number
  normalRate?: number
  scenarioPct: number
  scenarioRate?: number
  fieldPct: number
  doseEIQha?: number
  productEIQha?: number
  fieldEIQha?: number
  defaultEIQha?: number
}

function tierLabel(val: number){
  if (!val || val <= 0) return ''
  if (val < 200) return 'Expert'
  if (val < 500) return 'Master'
  if (val < 800) return 'Beginner'
  return 'Too high for Regenerative agriculture'
}

export default function App(){
  const [products, setProducts] = useState<Product[]>([])
  const [rows, setRows] = useState<Row[]>([
    { id: crypto.randomUUID(), product: '', times: 1, scenarioPct: 100, fieldPct: 100 },
  ])

  useEffect(() => {
    fetch('/products.json').then(r => r.json()).then(setProducts)
  }, [])

  function getProduct(name?: string){
    if(!name) return undefined
    return products.find(p => p.name === name)
  }

  function calcRow(row: Row){
    const p = getProduct(row.product)
    const normalRate = (row.normalRate ?? (p?.maxRate ?? p?.minRate ?? 0)) || 0
    const scenarioRate = normalRate * (row.scenarioPct / 100)
    const baseEiq = p?.eiqPerHa ?? 0
    const doseEIQha = normalRate > 0 ? baseEiq * (scenarioRate / normalRate) : 0
    const productEIQha = doseEIQha * (row.times ?? 0)
    const fieldEIQha = productEIQha * ((row.fieldPct ?? 0) / 100)
    const defaultEIQha = baseEiq * (row.times ?? 0)
    return { normalRate, scenarioRate, doseEIQha, productEIQha, fieldEIQha, defaultEIQha }
  }

  const computed = useMemo(() => rows.map(r => ({ ...r, ...calcRow(r) })), [rows, products])

  const totals = useMemo(() => {
    const normal = computed.reduce((s, r) => s + (r.defaultEIQha || 0), 0)
    const scenario = computed.reduce((s, r) => s + (r.fieldEIQha || 0), 0)
    const change = normal > 0 ? (scenario/normal - 1) : 0
    return { normal, scenario, change }
  }, [computed])

  function updateRow(id: string, patch: Partial<Row>){
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }
  function addRow(){
    setRows(prev => [...prev, { id: crypto.randomUUID(), product: '', times: 1, scenarioPct: 100, fieldPct: 100 }])
  }
  function removeRow(id: string){
    setRows(prev => prev.filter(r => r.id !== id))
  }

  function exportPDF(){
    const doc = new jsPDF()
    const dateStr = new Date().toLocaleString()
    doc.setFontSize(14)
    doc.text('Reporte – Calculadora EIQ (Escenario)', 14, 16)
    doc.setFontSize(10)
    doc.text(`Fecha: ${dateStr}`, 14, 22)

    ;(doc as any).autoTable({
      startY: 28,
      head: [[ '#','Producto','Veces','Normal rate','% Esc.','Scenario rate','% Campo','Dose EIQ/ha','Prod EIQ/ha','Field EIQ/ha','Default EIQ/ha' ]],
      body: computed.map((r, idx) => [
        idx+1,
        r.product || '-',
        r.times ?? '',
        (r.normalRate ?? '').toString(),
        r.scenarioPct ?? '',
        (r.scenarioRate ?? 0).toFixed(3),
        r.fieldPct ?? '',
        (r.doseEIQha ?? 0).toFixed(2),
        (r.productEIQha ?? 0).toFixed(2),
        (r.fieldEIQha ?? 0).toFixed(2),
        (r.defaultEIQha ?? 0).toFixed(2),
      ]),
      styles: { fontSize: 8 }
    })

    const finalY = (doc as any).lastAutoTable.finalY || 28
    doc.setFontSize(11)
    doc.text(`Normal field EIQ/ha: ${totals.normal.toFixed(2)}`, 14, finalY + 10)
    doc.text(`Scenario field EIQ/ha: ${totals.scenario.toFixed(2)}`, 14, finalY + 16)
    doc.text(`Change: ${(totals.change*100).toFixed(1)}%`, 14, finalY + 22)
    doc.text(`Tier: ${tierLabel(totals.scenario) || '—'}`, 14, finalY + 28)

    doc.save('reporte_eiq.pdf')
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 text-slate-900">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calculadora EIQ – Web</h1>
          <p className="text-sm text-slate-600">Paridad con Excel (solo cálculo) – Catálogo AR.</p>
        </div>
        <div className="text-right">
          <div className="text-sm">Normal field EIQ/ha: <span className="font-semibold">{totals.normal.toFixed(2)}</span></div>
          <div className="text-sm">Scenario field EIQ/ha: <span className="font-semibold">{totals.scenario.toFixed(2)}</span></div>
          <div className="text-sm">Change: <span className={totals.change>0?'text-red-600':'text-emerald-700'}>{(totals.change*100).toFixed(1)}%</span></div>
          <div className="mt-1 text-xs px-2 py-1 inline-block rounded-full bg-slate-100 border">Tier: <span className="font-medium">{tierLabel(totals.scenario) || '—'}</span></div>
          <div><button onClick={exportPDF} className="mt-2 px-3 py-2 rounded-md bg-slate-900 text-white">Generar PDF</button></div>
        </div>
      </header>

      <div className="bg-white rounded-2xl shadow p-4 border">
        <div className="grid grid-cols-12 gap-3 text-xs font-medium text-slate-600 px-2">
          <div className="col-span-1">#</div>
          <div className="col-span-3">Producto</div>
          <div className="col-span-2">Normal rate (kg/L·ha)</div>
          <div className="col-span-1">% Escenario</div>
          <div className="col-span-2">Scenario rate</div>
          <div className="col-span-1">% Campo</div>
          <div className="col-span-2 text-right">Field EIQ/ha</div>
        </div>

        <div className="divide-y">
          {computed.map((r, idx) => (
            <div key={r.id} className="grid grid-cols-12 gap-3 items-center px-2 py-2">
              <div className="col-span-1 flex items-center gap-2">
                <span className="text-slate-500">{idx+1}</span>
              </div>

              <div className="col-span-3">
                <input list="products" value={r.product || ''} onChange={e => updateRow(r.id, { product: e.target.value, normalRate: undefined })} className="w-full px-2 py-1 border rounded-md" placeholder="Seleccionar producto"/>
              </div>

              <div className="col-span-2">
                <input type="number" step="0.001" value={r.normalRate ?? ''} onChange={e => updateRow(r.id, { normalRate: e.target.value===''?undefined:Number(e.target.value) })} className="w-full px-2 py-1 border rounded-md" placeholder="Auto"/>
                <div className="text-[10px] text-slate-500">Auto desde Max rate; editable</div>
              </div>

              <div className="col-span-1">
                <input type="number" step="1" value={r.scenarioPct} onChange={e => updateRow(r.id, { scenarioPct: Number(e.target.value) })} className="w-full px-2 py-1 border rounded-md"/>
              </div>

              <div className="col-span-2">
                <input type="number" step="0.001" value={(r.scenarioRate ?? 0).toFixed(3)} readOnly className="w-full px-2 py-1 border rounded-md bg-slate-50"/>
              </div>

              <div className="col-span-1">
                <input type="number" step="1" value={r.fieldPct} onChange={e => updateRow(r.id, { fieldPct: Number(e.target.value) })} className="w-full px-2 py-1 border rounded-md"/>
              </div>

              <div className="col-span-2 text-right font-medium">
                {(r.fieldEIQha ?? 0).toFixed(2)}
              </div>

              <div className="col-span-12 grid grid-cols-12 gap-3 text-[11px] text-slate-600 mt-1">
                <div className="col-span-2">Veces:
                  <input type="number" min={1} value={r.times} onChange={e => updateRow(r.id, { times: Number(e.target.value) })} className="ml-2 w-20 px-2 py-0.5 border rounded-md"/>
                </div>
                <div className="col-span-3">Dose EIQ/ha: <span className="font-medium">{(r.doseEIQha ?? 0).toFixed(2)}</span></div>
                <div className="col-span-3">Product EIQ/ha: <span className="font-medium">{(r.productEIQha ?? 0).toFixed(2)}</span></div>
                <div className="col-span-4 text-right">Default EIQ/ha: <span className="font-medium">{(r.defaultEIQha ?? 0).toFixed(2)}</span></div>
              </div>

              <div className="col-span-12 flex justify-between mt-1">
                <button className="text-xs px-2 py-1 rounded-md border hover:bg-slate-50" onClick={() => removeRow(r.id)}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 flex items-center justify-between">
          <button className="px-3 py-2 rounded-md bg-slate-900 text-white" onClick={addRow}>Agregar fila</button>
          <datalist id="products">
            {products.map(p => <option key={p.name} value={p.name} />)}
          </datalist>
        </div>
      </div>

      <section className="text-sm text-slate-600">
        <h2 className="font-semibold text-slate-800">Notas de equivalencia (vs. Excel)</h2>
        <ul className="list-disc ml-5 mt-2 space-y-1">
          <li>Normal rate = Max rate (75th p histórico) por producto (editable).</li>
          <li>Scenario rate = Normal rate × (% escenario/100).</li>
          <li>EIQ/ha base proviene de la hoja “EIQ per product” y se escala linealmente por la dosis.</li>
          <li>Default EIQ/ha (Normal) = EIQ/ha base × veces.</li>
          <li>Field EIQ/ha (Scenario) = Dose EIQ/ha × veces × (% campo/100).</li>
          <li>Clasificación: &lt;200 Expert; &lt;500 Master; &lt;800 Beginner; ≥800 Too high for Regenerative agriculture.</li>
        </ul>
      </section>
    </div>
  )
}
