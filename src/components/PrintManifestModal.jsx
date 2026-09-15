import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, FileText, Tag, Check, Truck } from 'lucide-react';
import { formatLKR } from '../services/dbService';

function chunkArray(array, size) {
  const chunked = [];
  for (let i = 0; i < array.length; i += size) {
    chunked.push(array.slice(i, i + size));
  }
  return chunked;
}

export default function PrintManifestModal({ isOpen, onClose, orders = [], seller }) {
  const [printMode, setPrintMode] = useState('a4_grid_4');

  if (!isOpen || !orders.length) return null;

  const handlePrint = () => {
    window.print();
  };

  const totalCodToCollect = orders.reduce((sum, o) => {
    return sum + (o.payment_method === 'COD' ? Number(o.total_amount || 0) : 0);
  }, 0);

  const pagesOf4 = chunkArray(orders, 4);
  const pagesOf8 = chunkArray(orders, 8);

  const printCss = `
    @media print {
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        background: #fff !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      body > *:not(#print-root) {
        display: none !important;
      }

      #print-root {
        display: block !important;
        position: static !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        color: #000 !important;
      }

      * {
        box-sizing: border-box;
      }

      @page {
        size: ${printMode === 'thermal_a6' ? '100mm 150mm' : 'A4 portrait'};
        margin: 0;
      }

      .a4-page {
        width: 210mm;
        height: 296mm;
        padding: 4mm;
        position: relative;
        overflow: hidden;
        background: #fff;
        box-sizing: border-box;
      }

      .thermal-page {
        width: 100mm;
        height: 149mm;
        padding: 4mm;
        overflow: hidden;
        background: #fff;
        box-sizing: border-box;
      }

      .a4-page:not(:last-child),
      .thermal-page:not(:last-child) {
        break-after: page;
        page-break-after: always;
      }

      .a4-page,
      .thermal-page,
      .label-box-4,
      .label-box-8 {
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .label-box-4 {
        width: 97mm;
        height: 138mm;
        float: left;
        margin: 1mm;
        padding: 3mm;
        border: 1.5px solid #000;
        background: #fff;
        box-sizing: border-box;
      }

      .label-box-8 {
        width: 97mm;
        height: 67mm;
        float: left;
        margin: 1mm;
        padding: 2mm;
        border: 1px solid #000;
        background: #fff;
        box-sizing: border-box;
      }
    }
  `;

  const printRoot = (
    <div id="print-root" className="hidden print:block text-black bg-white font-sans">
      <style dangerouslySetInnerHTML={{ __html: printCss }} />

      {/* LAYOUT A: 4 PER A4 SHEET (2x2 Professional Grid) */}
      {printMode === 'a4_grid_4' && (
        <div>
          {pagesOf4.map((pageOrders, pageIdx) => (
            <div key={pageIdx} className="a4-page">
              {pageOrders.map((ord) => (
                <div key={ord.id} className="label-box-4 flex flex-col justify-between text-xs leading-normal">

                  {/* Top Store & Order Identification */}
                  <div className="border-b-2 border-black pb-2 flex justify-between items-start">
                    <div>
                      <div className="font-black text-sm uppercase tracking-wide">{seller?.shop_name || 'STORE'}</div>
                      <div className="text-[10px] font-mono text-black">Store Link: ordy.lk/{seller?.handle}</div>
                      <div className="text-[10px] font-mono text-black">WhatsApp: {seller?.whatsapp_number}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-lg">#{ord.order_code || ord.id.slice(0, 4)}</div>
                      <div className="text-[10px] font-bold text-black">
                        Date: {new Date(ord.created_at).toLocaleDateString('en-GB')}
                      </div>
                    </div>
                  </div>

                  {/* Customer & Destination Details */}
                  <div className="my-1.5 space-y-1 text-xs">
                    <div className="font-black uppercase text-[10px] text-black tracking-wider border-b border-black pb-0.5">
                      Delivery Recipient
                    </div>
                    <div><span className="font-bold">Name:</span> {ord.customer_name}</div>
                    <div className="font-mono">
                      <span className="font-bold">Primary Tel:</span> {ord.customer_phone}
                    </div>
                    {ord.secondary_phone && (
                      <div className="font-mono">
                        <span className="font-bold">Secondary Tel:</span> {ord.secondary_phone}
                      </div>
                    )}
                    <div className="leading-snug">
                      <span className="font-bold">Address:</span> {ord.delivery_address}, {ord.city}
                    </div>
                    <div className="font-black uppercase pt-0.5">
                      District: {ord.district || ord.city}
                    </div>
                  </div>

                  {/* Flexible Item Manifest */}
                  <div className="border-t border-b border-black py-1 my-1 text-xs flex-1 overflow-hidden flex flex-col">
                    <div className="font-bold uppercase text-[10px] text-black tracking-wider mb-0.5">
                      Package Manifest:
                    </div>
                    <div className="space-y-1 overflow-y-auto flex-1">
                      {(ord.items || []).map((item, i) => (
                        <div key={i} className="flex justify-between items-start text-xs border-b border-dotted border-gray-300 pb-0.5">
                          <span className="pr-2 font-medium">• {item.title}</span>
                          <span className="font-bold shrink-0 font-mono">Qty: {item.quantity || 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Clear COD / Payment Box */}
                  <div className="p-2 rounded text-center border-2 border-black mt-1">
                    <div className="text-[10px] font-black uppercase tracking-wider">
                      {ord.payment_method === 'COD' ? 'CASH ON DELIVERY (COD)' : 'PREPAID ORDER'}
                    </div>
                    <div className="text-sm font-black mt-0.5">
                      {ord.payment_method === 'COD' ? `COLLECT AMOUNT: ${formatLKR(ord.total_amount)}` : 'PREPAID - DO NOT COLLECT CASH'}
                    </div>
                  </div>

                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* LAYOUT B: 8 PER A4 SHEET (2x4 Compact Grid) */}
      {printMode === 'a4_grid_8' && (
        <div>
          {pagesOf8.map((pageOrders, pageIdx) => (
            <div key={pageIdx} className="a4-page">
              {pageOrders.map((ord) => (
                <div key={ord.id} className="label-box-8 flex flex-col justify-between text-[11px] leading-tight">
                  <div className="border-b border-black pb-1 flex justify-between items-start">
                    <div>
                      <div className="font-black text-xs uppercase">{seller?.shop_name}</div>
                      <div className="text-[9px] font-mono">ordy.lk/{seller?.handle} • {seller?.whatsapp_number}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-xs">#{ord.order_code || ord.id.slice(0, 4)}</div>
                      <div className="text-[8px] font-bold">{new Date(ord.created_at).toLocaleDateString('en-GB')}</div>
                    </div>
                  </div>

                  <div className="space-y-0.5 my-1">
                    <div className="font-black text-xs truncate">
                      <span className="font-bold">To:</span> {ord.customer_name} | <span className="font-mono">{ord.customer_phone}</span> {ord.secondary_phone ? `| ${ord.secondary_phone}` : ''}
                    </div>
                    <div className="text-[10px] font-medium truncate">
                      {ord.delivery_address}, {ord.city} ({ord.district || ord.city})
                    </div>
                  </div>

                  <div className="p-1 rounded text-center border border-black">
                    <div className="text-[9px] font-black uppercase">
                      {ord.payment_method === 'COD' ? `COLLECT COD: ${formatLKR(ord.total_amount)}` : 'PREPAID (NO CASH COLLECTION)'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* LAYOUT C: 4x6 THERMAL STICKER (A6 Single) */}
      {printMode === 'thermal_a6' && (
        <div>
          {orders.map((ord) => (
            <div key={ord.id} className="thermal-page p-3 mx-auto flex flex-col justify-between text-xs leading-normal border-2 border-black bg-white">
              <div className="border-b-2 border-black pb-2 flex justify-between items-start">
                <div>
                  <div className="font-black text-base uppercase">{seller?.shop_name}</div>
                  <div className="text-[10px] font-medium">Store Link: ordy.lk/{seller?.handle}</div>
                  <div className="text-[10px] font-mono">Hotline: {seller?.whatsapp_number}</div>
                </div>
                <div className="text-right">
                  <div className="font-black text-xl">#{ord.order_code || ord.id.slice(0, 4)}</div>
                  <div className="text-[10px] font-bold">
                    {new Date(ord.created_at).toLocaleDateString('en-GB')}
                  </div>
                </div>
              </div>

              <div className="space-y-1 my-1">
                <div className="text-[10px] font-black uppercase tracking-wider border-b border-black pb-0.5">
                  Receiver Details
                </div>
                <div><span className="font-bold">Name:</span> {ord.customer_name}</div>
                <div className="font-mono"><span className="font-bold">Primary Tel:</span> {ord.customer_phone}</div>
                {ord.secondary_phone && (
                  <div className="font-mono"><span className="font-bold">Secondary Tel:</span> {ord.secondary_phone}</div>
                )}
                <div className="leading-snug"><span className="font-bold">Address:</span> {ord.delivery_address}, {ord.city}</div>
                <div className="font-black uppercase text-xs pt-0.5">District: {ord.district || ord.city}</div>
              </div>

              <div className="border-t border-b border-black py-1.5 my-1 text-xs flex-1 overflow-hidden flex flex-col">
                <div className="font-black text-[10px] uppercase tracking-wider mb-1">
                  Package Manifest:
                </div>
                <div className="space-y-1 overflow-y-auto flex-1">
                  {(ord.items || []).map((item, i) => (
                    <div key={i} className="flex justify-between font-bold border-b border-dotted border-gray-400 pb-0.5 text-xs">
                      <span className="pr-1">• {item.title}</span>
                      <span className="shrink-0 font-mono">Qty: {item.quantity || 1}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-2.5 text-center border-4 border-black mt-1">
                <div className="text-xs font-black uppercase tracking-wider">
                  {ord.payment_method === 'COD' ? 'CASH ON DELIVERY (COD)' : 'PREPAID ORDER'}
                </div>
                <div className="text-lg font-black mt-0.5">
                  {ord.payment_method === 'COD' ? formatLKR(ord.total_amount) : 'NO CASH COLLECTION'}
                </div>
              </div>

              <div className="text-[9px] text-center font-mono mt-1">
                Generated via Ordy.lk
              </div>
            </div>
          ))}
        </div>
      )}

      {/* LAYOUT D: COURIER HANDOVER SHEET */}
      {printMode === 'courier_manifest' && (
        <div className="w-[190mm] mx-auto p-4 text-xs font-sans">
          <div className="border-b-2 border-black pb-3 flex justify-between items-end">
            <div>
              <h1 className="font-black text-xl uppercase">{seller?.shop_name} — Courier Pickup Sheet</h1>
              <div className="text-xs font-mono mt-0.5">
                Store Contact: {seller?.whatsapp_number} • Date: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
            <div className="text-right">
              <div className="font-black text-sm">Total Parcels: {orders.length}</div>
              <div className="font-black text-sm">Total COD: {formatLKR(totalCodToCollect)}</div>
            </div>
          </div>

          <table className="w-full mt-4 border-collapse border border-black text-left text-xs">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-black">
                <th className="border border-black p-2 w-12 text-center">#</th>
                <th className="border border-black p-2 w-20">Order ID</th>
                <th className="border border-black p-2">Customer & Address</th>
                <th className="border border-black p-2 w-36">Phone Numbers</th>
                <th className="border border-black p-2 w-24">District</th>
                <th className="border border-black p-2 w-28 text-right">COD Value</th>
                <th className="border border-black p-2 w-24 text-center">Rider Check</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((ord, idx) => (
                <tr key={ord.id} className="border-b border-gray-400">
                  <td className="border border-black p-2 text-center font-bold">{idx + 1}</td>
                  <td className="border border-black p-2 font-mono font-black">#{ord.order_code || ord.id.slice(0, 4)}</td>
                  <td className="border border-black p-2">
                    <div className="font-bold">{ord.customer_name}</div>
                    <div className="text-[10px] truncate max-w-xs">{ord.delivery_address}, {ord.city}</div>
                  </td>
                  <td className="border border-black p-2 font-mono font-bold text-[11px]">
                    <div>{ord.customer_phone}</div>
                    {ord.secondary_phone && <div className="text-gray-600">Alt: {ord.secondary_phone}</div>}
                  </td>
                  <td className="border border-black p-2 font-bold uppercase text-[11px]">{ord.district || ord.city}</td>
                  <td className="border border-black p-2 text-right font-black">
                    {ord.payment_method === 'COD' ? formatLKR(ord.total_amount) : 'PAID'}
                  </td>
                  <td className="border border-black p-2 text-center">
                    <div className="w-4 h-4 border border-black mx-auto rounded-xs" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-8 pt-4 border-t-2 border-black grid grid-cols-2 gap-8 text-xs">
            <div className="space-y-4">
              <div className="font-bold">Merchant Handover Acknowledgment:</div>
              <div className="pt-6 border-b border-black w-3/4" />
              <div className="text-[10px]">Signature / Seal & Time of Pickup</div>
            </div>

            <div className="space-y-4">
              <div className="font-bold">Courier Rider Acceptance:</div>
              <div className="text-[11px]">Rider Name: ____________________________</div>
              <div className="pt-6 border-b border-black w-3/4" />
              <div className="text-[10px]">Rider Signature (Proof of Physical Custody)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 bg-[#18181B]/70 flex items-center justify-center p-3 sm:p-4 z-50 print:hidden overflow-y-auto">
        <div className="bg-white rounded-[32px] p-6 max-w-lg w-full shadow-2xl space-y-5 text-[#18181B]">
          <div className="flex justify-between items-center border-b border-[#E4E4E7] pb-3">
            <div>
              <h3 className="font-black text-sm">Print Labels & Manifest</h3>
              <p className="text-[11px] text-[#71717A]">{orders.length} order{orders.length === 1 ? '' : 's'} selected for dispatch</p>
            </div>
            <button onClick={onClose} className="text-stone-400 hover:text-black">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <label className="font-bold text-[#71717A] uppercase text-[10px] tracking-wider block">
              Choose Print Layout
            </label>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setPrintMode('a4_grid_4')}
                className={`p-3 rounded-2xl border text-left flex items-start justify-between transition ${
                  printMode === 'a4_grid_4' ? 'border-[#006241] bg-[#E8F0E9]/40' : 'border-[#E4E4E7] bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl shrink-0 ${printMode === 'a4_grid_4' ? 'bg-[#006241] text-white' : 'bg-[#F4F4F5] text-[#71717A]'}`}>
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">4 Labels per A4 Sheet (Standard Grid)</div>
                    <div className="text-[11px] text-[#71717A] mt-0.5">Prints up to 4 shipping slips per page in a 2×2 grid. Zero blank pages.</div>
                  </div>
                </div>
                {printMode === 'a4_grid_4' && <Check className="w-4 h-4 text-[#006241] shrink-0 mt-1" />}
              </button>

              <button
                type="button"
                onClick={() => setPrintMode('a4_grid_8')}
                className={`p-3 rounded-2xl border text-left flex items-start justify-between transition ${
                  printMode === 'a4_grid_8' ? 'border-[#006241] bg-[#E8F0E9]/40' : 'border-[#E4E4E7] bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl shrink-0 ${printMode === 'a4_grid_8' ? 'bg-[#006241] text-white' : 'bg-[#F4F4F5] text-[#71717A]'}`}>
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">8 Labels per A4 Sheet (Compact Grid)</div>
                    <div className="text-[11px] text-[#71717A] mt-0.5">Prints up to 8 compact labels per A4 page in a 2×4 grid.</div>
                  </div>
                </div>
                {printMode === 'a4_grid_8' && <Check className="w-4 h-4 text-[#006241] shrink-0 mt-1" />}
              </button>

              <button
                type="button"
                onClick={() => setPrintMode('thermal_a6')}
                className={`p-3 rounded-2xl border text-left flex items-start justify-between transition ${
                  printMode === 'thermal_a6' ? 'border-[#006241] bg-[#E8F0E9]/40' : 'border-[#E4E4E7] bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl shrink-0 ${printMode === 'thermal_a6' ? 'bg-[#006241] text-white' : 'bg-[#F4F4F5] text-[#71717A]'}`}>
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">4×6" Thermal Sticker (A6 Single Roll)</div>
                    <div className="text-[11px] text-[#71717A] mt-0.5">1 order per sticker label for barcode thermal printers.</div>
                  </div>
                </div>
                {printMode === 'thermal_a6' && <Check className="w-4 h-4 text-[#006241] shrink-0 mt-1" />}
              </button>

              <button
                type="button"
                onClick={() => setPrintMode('courier_manifest')}
                className={`p-3 rounded-2xl border text-left flex items-start justify-between transition ${
                  printMode === 'courier_manifest' ? 'border-[#006241] bg-[#E8F0E9]/40' : 'border-[#E4E4E7] bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl shrink-0 ${printMode === 'courier_manifest' ? 'bg-[#006241] text-white' : 'bg-[#F4F4F5] text-[#71717A]'}`}>
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">Courier Handover Sheet (Pickup Manifest)</div>
                    <div className="text-[11px] text-[#71717A] mt-0.5">Summary table with rider signature line for custody proof.</div>
                  </div>
                </div>
                {printMode === 'courier_manifest' && <Check className="w-4 h-4 text-[#006241] shrink-0 mt-1" />}
              </button>
            </div>
          </div>

          <div className="bg-[#F4F4F5] p-3 rounded-2xl border border-[#E4E4E7] flex justify-between items-center text-xs">
            <span className="text-[#71717A]">Total COD to Collect:</span>
            <span className="font-black text-sm text-[#006241]">{formatLKR(totalCodToCollect)}</span>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-[#F4F4F5] hover:bg-stone-200 text-[#18181B] font-bold rounded-xl text-xs transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 py-3 bg-[#006241] hover:bg-[#004F34] text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-2xs active:scale-95"
            >
              <Printer className="w-4 h-4" /> Print Document
            </button>
          </div>
        </div>
      </div>

      {typeof document !== 'undefined' && createPortal(printRoot, document.body)}
    </>
  );
}