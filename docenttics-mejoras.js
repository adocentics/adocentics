/* ============================================================
   DocentTics — Mejoras v1.0
   Archivo: docenttics-mejoras.js
   Pegar antes del </body> del index.html:
   <script src="docenttics-mejoras.js"></script>
   ============================================================ */

/* ─────────────────────────────────────────────
   1. CONFIGURACIÓN DE PLANES
   ─────────────────────────────────────────────*/
const PLANES = {
  Basico:   { nombre: 'Básico',   precio: 15, pdfs_semana: 2, simulacros_mes: 4 },
  Completo: { nombre: 'Completo', precio: 20, pdfs_semana: 4, simulacros_mes: 6 },
  Premium:  { nombre: 'Premium',  precio: 29, pdfs_semana: 999, simulacros_mes: 999 },
  Admin:    { nombre: 'Admin',    precio: 0,  pdfs_semana: 999, simulacros_mes: 999 }
};

/* ─────────────────────────────────────────────
   2. OBTENER PLAN DEL DOCENTE EN SESIÓN
   ─────────────────────────────────────────────*/
function getPlanActual() {
  try {
    const d = JSON.parse(sessionStorage.getItem('docente') || '{}');
    return d.plan || 'Basico';
  } catch { return 'Basico'; }
}

function getLimitePDFs() {
  return PLANES[getPlanActual()]?.pdfs_semana ?? 2;
}

/* ─────────────────────────────────────────────
   3. CONTADOR SEMANAL DE PDFs (localStorage)
   El contador se resetea cada lunes.
   ─────────────────────────────────────────────*/
function _mesKey() {
  return 'dt_pdfs_' + new Date().toISOString().slice(0,7);
}

function _getPDFsUsados() {
  // Primero intentar desde sessionStorage (sincronizado con Supabase)
  try {
    const d = JSON.parse(sessionStorage.getItem('docente')||'{}');
    if(d.simulacros_usados !== undefined) return d.simulacros_usados;
  } catch(_){}
  // Fallback localStorage
  return parseInt(localStorage.getItem(_mesKey())||'0');
}

function _incrementarPDFsUsados() {
  const key = _mesKey();
  const actual = parseInt(localStorage.getItem(key)||'0');
  localStorage.setItem(key, actual+1);
}


function getPDFsUsados() {
  const key = _mesKey();
  // Limpiar claves de semanas anteriores
  Object.keys(localStorage)
    .filter(k => k.startsWith('dt_pdfs_') && k !== key)
    .forEach(k => localStorage.removeItem(k));
  return parseInt(localStorage.getItem(key) || '0', 10);
}

function incrementarPDFsUsados() {
  const key = _mesKey();
  const actual = getPDFsUsados();
  localStorage.setItem(key, actual + 1);
  return actual + 1;
}

function puedeDescargarPDF() {
  return getPDFsUsados() < getLimitePDFs();
}

/* ─────────────────────────────────────────────
   4. GENERADOR DE PDF SOLUCIONARIO (jsPDF)
   Carga jsPDF dinámicamente si no está disponible.
   ─────────────────────────────────────────────*/
function cargarJsPDF(callback) {
  if (window.jspdf || window.jsPDF) {
    callback();
    return;
  }
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  s.onload = callback;
  s.onerror = () => toast('❌ No se pudo cargar el generador de PDF. Verifica tu conexión.', '#C0392B');
  document.head.appendChild(s);
}

function generarSolucionarioPDF(estadoExamen) {
  if (!puedeDescargarPDF()) {
    const limite = getLimitePDFs();
    const plan   = getPlanActual();
    const sig    = plan === 'Basico' ? 'Completo' : 'Premium';
    toast(`⛔ Alcanzaste tus ${limite} PDFs esta semana. Sube al plan ${sig} para más.`, '#E67E22');
    return;
  }

  cargarJsPDF(() => {
    try {
      const jsPDFLib = window.jspdf?.jsPDF || window.jsPDF;
      if (!jsPDFLib) { toast('❌ Error al inicializar jsPDF.', '#C0392B'); return; }

      const doc = new jsPDFLib({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const docente = JSON.parse(sessionStorage.getItem('docente') || '{}');
      const nombre  = docente.nombre || 'Docente';
      const plan    = getPlanActual();

      // ── Colores corporativos ──────────────────
      const AZUL    = [26, 95, 180];
      const OSCURO  = [20, 30, 48];
      const GRIS    = [100, 110, 130];
      const VERDE   = [30, 180, 100];
      const ROJO    = [192, 57, 43];
      const BLANCO  = [255, 255, 255];
      const FONDO   = [245, 247, 252];

      const W = 210;
      const MARGEN = 18;

      // ── Cabecera azul ─────────────────────────
      doc.setFillColor(...AZUL);
      doc.rect(0, 0, W, 38, 'F');

      doc.setTextColor(...BLANCO);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('DocentTics', MARGEN, 16);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Plataforma para docentes peruanos', MARGEN, 23);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('SOLUCIONARIO DEL SIMULACRO', W / 2, 31, { align: 'center' });

      // ── Datos del docente ─────────────────────
      let y = 48;
      doc.setFillColor(...FONDO);
      doc.roundedRect(MARGEN, y - 5, W - MARGEN * 2, 30, 3, 3, 'F');

      doc.setTextColor(...OSCURO);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(nombre, MARGEN + 4, y + 3);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...GRIS);

      const fechaHoy = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
      const concurso = estadoExamen.concurso === 'asc' ? 'Ascenso de Escala' : 'Nombramiento';
      const modalidad = docente.modalidad || '';
      const especialidad = docente.especialidad || '';
      const infoExtra = [modalidad, especialidad].filter(Boolean).join(' · ');

      doc.text(infoExtra || 'Docente', MARGEN + 4, y + 10);
      doc.text(`Plan ${plan} · ${fechaHoy}`, MARGEN + 4, y + 17);
      doc.text(`Concurso: ${concurso}`, W - MARGEN - 4, y + 10, { align: 'right' });

      // ── Calcular resultados ───────────────────
      let ptHG = 0, ptEsp = 0, correctas = 0, incorrectas = 0, sinResponder = 0;
      const mxHG  = estadoExamen.preguntas.filter(p => p.subprueba === 'hg').reduce((a, p) => a + (p.pts || 2), 0);
      const mxEsp = estadoExamen.preguntas.filter(p => p.subprueba === 'esp').reduce((a, p) => a + (p.pts || 3), 0);
      const mxTotal = mxHG + mxEsp || estadoExamen.preguntas.reduce((a, p) => a + (p.pts || 3), 0);

      estadoExamen.preguntas.forEach((p, i) => {
        const resp = estadoExamen.respuestas[i];
        if (resp === null || resp === undefined) { sinResponder++; return; }
        if (resp === p.correcta) {
          correctas++;
          const pts = p.pts || (p.subprueba === 'hg' ? 2 : 3);
          if (p.subprueba === 'hg') ptHG += pts; else ptEsp += pts;
        } else { incorrectas++; }
      });

      const ptsAsc   = estadoExamen.concurso === 'asc' ? correctas * 3 : 0;
      const total    = estadoExamen.concurso === 'asc' ? ptsAsc : (ptHG + ptEsp);
      const aprueba  = estadoExamen.concurso === 'asc' ? total >= mxTotal * 0.55 : total >= 110;

      // ── Resumen de puntaje ────────────────────
      y += 38;
      doc.setFillColor(...AZUL);
      doc.roundedRect(MARGEN, y, W - MARGEN * 2, 8, 2, 2, 'F');
      doc.setTextColor(...BLANCO);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('RESUMEN DE RESULTADOS', MARGEN + 4, y + 5.5);
      y += 12;

      const celdas = [
        { label: 'CORRECTAS',     val: correctas,   color: VERDE },
        { label: 'INCORRECTAS',   val: incorrectas, color: ROJO },
        { label: 'SIN RESPONDER', val: sinResponder, color: GRIS },
        { label: 'PUNTAJE TOTAL', val: `${total} / ${mxTotal}`, color: aprueba ? VERDE : ROJO }
      ];

      const cw = (W - MARGEN * 2) / celdas.length;
      celdas.forEach((c, i) => {
        const cx = MARGEN + i * cw;
        doc.setFillColor(...FONDO);
        doc.roundedRect(cx, y, cw - 2, 18, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(...c.color);
        doc.text(String(c.val), cx + cw / 2 - 1, y + 10, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...GRIS);
        doc.text(c.label, cx + cw / 2 - 1, y + 15.5, { align: 'center' });
      });
      y += 22;

      if (estadoExamen.concurso === 'nom' && mxHG > 0 && mxEsp > 0) {
        doc.setFillColor(...FONDO);
        doc.roundedRect(MARGEN, y, (W - MARGEN * 2) / 2 - 2, 14, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...AZUL);
        doc.text(`HG: ${ptHG} / ${mxHG} pts`, MARGEN + 4, y + 9);

        doc.setFillColor(...FONDO);
        doc.roundedRect(MARGEN + (W - MARGEN * 2) / 2 + 2, y, (W - MARGEN * 2) / 2 - 2, 14, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(180, 80, 20);
        doc.text(`ESP: ${ptEsp} / ${mxEsp} pts`, MARGEN + (W - MARGEN * 2) / 2 + 6, y + 9);
        y += 18;
      }

      // Indicador aprueba / no aprueba
      doc.setFillColor(...(aprueba ? [230, 255, 240] : [255, 235, 235]));
      doc.roundedRect(MARGEN, y, W - MARGEN * 2, 10, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...(aprueba ? VERDE : ROJO));
      const textoAp = aprueba
        ? `✓ APRUEBA el puntaje mínimo (${total} pts)`
        : `✗ No alcanza el puntaje mínimo (${total} pts — mín. 110 requerido)`;
      doc.text(textoAp, W / 2, y + 6.5, { align: 'center' });
      y += 15;

      // ── Detalle por pregunta ──────────────────
      doc.setFillColor(...AZUL);
      doc.roundedRect(MARGEN, y, W - MARGEN * 2, 8, 2, 2, 'F');
      doc.setTextColor(...BLANCO);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('DETALLE POR PREGUNTA', MARGEN + 4, y + 5.5);
      y += 12;

      estadoExamen.preguntas.forEach((p, i) => {
        if (y > 265) { doc.addPage(); y = 20; }

        const resp = estadoExamen.respuestas[i];
        const esCorrecta = resp === p.correcta;
        const sinResp    = resp === null || resp === undefined;

        const bgColor = sinResp ? [248, 248, 248]
          : esCorrecta ? [235, 250, 242]
          : [255, 238, 236];
        const borderColor = sinResp ? GRIS
          : esCorrecta ? VERDE
          : ROJO;

        // Borde izquierdo de color
        doc.setFillColor(...borderColor);
        doc.rect(MARGEN, y, 2.5, 28, 'F');

        doc.setFillColor(...bgColor);
        doc.rect(MARGEN + 2.5, y, W - MARGEN * 2 - 2.5, 28, 'F');

        // Número y estado
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...OSCURO);
        doc.text(`Pregunta ${i + 1}`, MARGEN + 5, y + 5);

        const estadoTexto = sinResp ? 'Sin responder'
          : esCorrecta ? '✓ Correcta'
          : '✗ Incorrecta';
        doc.setTextColor(...borderColor);
        doc.setFontSize(8);
        doc.text(estadoTexto, W - MARGEN - 3, y + 5, { align: 'right' });

        // Texto de la pregunta (recortado)
        doc.setTextColor(...OSCURO);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        const textoP = doc.splitTextToSize(p.texto, W - MARGEN * 2 - 8);
        doc.text(textoP[0] + (textoP.length > 1 ? '…' : ''), MARGEN + 5, y + 10);

        // Respuestas
        const letras = ['A', 'B', 'C', 'D'];
        const respLabel = !sinResp ? `Tu resp: ${letras[resp] || resp}` : 'Sin resp.';
        const corrLabel = `Correcta: ${letras[p.correcta]}`;

        doc.setFontSize(7);
        doc.setTextColor(...GRIS);
        doc.text(respLabel, MARGEN + 5, y + 16);
        doc.setTextColor(...VERDE);
        doc.text(corrLabel, MARGEN + 40, y + 16);

        // Explicación
        if (p.explicacion) {
          doc.setTextColor(...GRIS);
          doc.setFontSize(6.5);
          const expLines = doc.splitTextToSize('→ ' + p.explicacion, W - MARGEN * 2 - 8);
          doc.text(expLines[0] + (expLines.length > 1 ? '…' : ''), MARGEN + 5, y + 22);
        }

        y += 31;
      });

      // ── Sección de recomendaciones ────────────
      if (y > 230) { doc.addPage(); y = 20; }

      // Detectar temas débiles (incorrectas)
      const temasDebiles = {};
      estadoExamen.preguntas.forEach((p, i) => {
        const resp = estadoExamen.respuestas[i];
        if (resp !== null && resp !== undefined && resp !== p.correcta) {
          const sub = p.subprueba === 'hg' ? 'Habilidades Generales' : 'Especialidad';
          temasDebiles[sub] = (temasDebiles[sub] || 0) + 1;
        }
      });

      y += 4;
      doc.setFillColor(...AZUL);
      doc.roundedRect(MARGEN, y, W - MARGEN * 2, 8, 2, 2, 'F');
      doc.setTextColor(...BLANCO);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('RECOMENDACIONES PARA EL PRÓXIMO SIMULACRO', MARGEN + 4, y + 5.5);
      y += 12;

      doc.setFillColor(...FONDO);
      doc.roundedRect(MARGEN, y, W - MARGEN * 2, 22, 2, 2, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...OSCURO);

      let recomendacion = '';
      if (Object.keys(temasDebiles).length === 0) {
        recomendacion = '¡Excelente! No tienes errores. Mantén tu ritmo de práctica y revisa los temas de mayor puntaje.';
      } else {
        const partes = Object.entries(temasDebiles)
          .sort((a, b) => b[1] - a[1])
          .map(([sub, n]) => `${sub} (${n} error${n > 1 ? 'es' : ''})`);
        recomendacion = `Refuerza: ${partes.join(' y ')}. Repasa los temas con más errores antes del próximo simulacro.`;
      }

      const recLines = doc.splitTextToSize(recomendacion, W - MARGEN * 2 - 8);
      doc.text(recLines, MARGEN + 4, y + 7);
      y += 26;

      // ── Pie de página ─────────────────────────
      const totalPags = doc.internal.getNumberOfPages();
      for (let pg = 1; pg <= totalPags; pg++) {
        doc.setPage(pg);
        doc.setFillColor(...AZUL);
        doc.rect(0, 287, W, 10, 'F');
        doc.setTextColor(...BLANCO);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text('DocentTics — Plataforma para docentes peruanos', MARGEN, 293);
        doc.text(`Pág. ${pg} / ${totalPags}`, W - MARGEN, 293, { align: 'right' });
      }

      // ── Guardar y actualizar contador ─────────
      const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      doc.save(`DocentTics_Solucionario_${fecha}.pdf`);
      incrementarPDFsUsados();
      actualizarBtnSolucionario();
      toast('✅ Solucionario descargado correctamente.', '#1A7A4A');

    } catch (err) {
      console.error('Error generando PDF:', err);
      toast('❌ Ocurrió un error al generar el PDF.', '#C0392B');
    }
  });
}

/* ─────────────────────────────────────────────
   5. BOTÓN DE SOLUCIONARIO EN PANTALLA RESULTADO
   Se inyecta automáticamente al mostrar el resultado.
   ─────────────────────────────────────────────*/
function actualizarBtnSolucionario() {
  const btn = document.getElementById('dt-btn-solucionario');
  if (!btn) return;

  const usados = getPDFsUsados();
  const limite = getLimitePDFs();
  const puede  = usados < limite;

  btn.disabled = !puede;
  btn.style.opacity = puede ? '1' : '0.5';
  btn.style.cursor  = puede ? 'pointer' : 'not-allowed';

  const counter = document.getElementById('dt-pdf-counter');
  if (counter) {
    counter.textContent = `${usados} de ${limite} PDFs usados esta semana`;
    counter.style.color = puede ? 'var(--gris, #666)' : '#C0392B';
  }
}

function inyectarBtnSolucionario() {
  // Evitar duplicados
  if (document.getElementById('dt-btn-solucionario')) {
    actualizarBtnSolucionario();
    return;
  }

  // Buscar el contenedor de botones en la pantalla resultado
  // (usa los botones existentes como referencia)
  const btnsExistentes = document.querySelector('#resultado .res-btns, #resultado .btn-wrap');
  if (!btnsExistentes) {
    // Crear wrapper si no existe
    const resScreen = document.getElementById('resultado');
    if (!resScreen) return;
    const wrapper = document.createElement('div');
    wrapper.id = 'dt-pdf-wrapper';
    wrapper.style.cssText = 'margin:16px auto;text-align:center;max-width:520px;padding:0 20px';
    wrapper.innerHTML = buildBtnSolucionarioHTML();
    resScreen.appendChild(wrapper);
  } else {
    const div = document.createElement('div');
    div.id = 'dt-pdf-wrapper';
    div.style.cssText = 'margin-top:14px;text-align:center';
    div.innerHTML = buildBtnSolucionarioHTML();
    btnsExistentes.appendChild(div);
  }

  document.getElementById('dt-btn-solucionario').addEventListener('click', () => {
    if (typeof estado !== 'undefined') {
      generarSolucionarioPDF(estado);
    } else {
      toast('❌ No se encontró el estado del examen.', '#C0392B');
    }
  });

  actualizarBtnSolucionario();
}

function buildBtnSolucionarioHTML() {
  return `
    <button id="dt-btn-solucionario"
      style="background:linear-gradient(135deg,#1A5FB4,#1565C0);color:#fff;
             border:none;padding:11px 28px;border-radius:8px;font-size:14px;
             font-weight:600;cursor:pointer;display:inline-flex;align-items:center;
             gap:8px;box-shadow:0 3px 12px rgba(26,95,180,.35);
             font-family:var(--FC,'DM Sans',sans-serif);transition:transform .15s">
      📄 Descargar solucionario PDF
    </button>
    <div id="dt-pdf-counter"
      style="margin-top:7px;font-size:12px;color:#666;
             font-family:var(--FC,'DM Sans',sans-serif)">
      — de — PDFs usados esta semana
    </div>
  `;
}

/* ─────────────────────────────────────────────
   6. SECCIÓN DE GUÍAS DE IA EN EL SIDEBAR
   ─────────────────────────────────────────────*/
const GUIAS_IA = [
  { id: 'gemini',    titulo: 'Gemini para docentes',    ico: '🤖', plan: 'Completo',
    desc: 'Planifica clases y resume documentos del MINEDU con IA.' },
  { id: 'chatgpt',   titulo: 'ChatGPT para docentes',   ico: '💬', plan: 'Completo',
    desc: 'Prompts listos: rúbricas, actividades CNEB y exámenes.' },
  { id: 'canva',     titulo: 'Canva IA para el aula',   ico: '🎨', plan: 'Completo',
    desc: 'Crea infografías y presentaciones en minutos.' },
  { id: 'heygen',    titulo: 'HeyGen — videos sin cámara', ico: '🎬', plan: 'Premium',
    desc: 'Genera clases en video con tu avatar docente.' },
  { id: 'sesiones',  titulo: 'Sesiones de aprendizaje con IA', ico: '📚', plan: 'Premium',
    desc: 'Diseña sesiones completas alineadas al CNEB.' },
];

function renderSeccionIA() {
  const plan = getPlanActual();

  const items = GUIAS_IA.map(g => {
    const bloqueado = (g.plan === 'Premium' && plan !== 'Premium') ||
                      (g.plan === 'Completo' && plan === 'Basico');
    return `
      <div style="background:${bloqueado ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.07)'};
                  border-radius:8px;padding:12px 14px;margin-bottom:8px;
                  opacity:${bloqueado ? '.55' : '1'};cursor:${bloqueado ? 'default' : 'pointer'}"
           onclick="${bloqueado ? `toast('🔒 Esta guía requiere plan ${g.plan}.','#E67E22')` : `abrirGuiaIA('${g.id}')`}">
        <div style="display:flex;align-items:center;gap:9px;margin-bottom:4px">
          <span style="font-size:18px">${g.ico}</span>
          <span style="font-size:12.5px;font-weight:600;color:#fff">${g.titulo}</span>
          <span style="margin-left:auto;font-size:10px;padding:2px 7px;border-radius:10px;
                       background:${bloqueado ? 'rgba(255,255,255,.12)' : (g.plan==='Premium'?'#B8860B':'#1A5FB4')};
                       color:${bloqueado ? '#aaa' : '#fff'}">
            ${bloqueado ? '🔒 ' : ''}${g.plan}
          </span>
        </div>
        <div style="font-size:11px;color:#8899AA;padding-left:27px">${g.desc}</div>
      </div>`;
  }).join('');

  return `
    <div id="seccion-ia">
      <div style="font-size:11px;font-weight:600;letter-spacing:.06em;color:#4D7EA8;
                  padding:10px 0 8px;text-transform:uppercase">IA PARA DOCENTES</div>
      ${items}
    </div>`;
}

function abrirGuiaIA(id) {
  const g = GUIAS_IA.find(x => x.id === id);
  if (!g) return;

  // Por ahora muestra un modal informativo.
  // Cuando subas los PDFs a Supabase Storage, reemplaza esto por la URL de descarga.
  const modal = document.createElement('div');
  modal.id = 'dt-ia-modal';
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9999;
    display:flex;align-items:center;justify-content:center;padding:20px`;
  modal.innerHTML = `
    <div style="background:#1C2A3A;border-radius:14px;padding:28px;max-width:420px;width:100%;
                box-shadow:0 20px 60px rgba(0,0,0,.5);position:relative">
      <button onclick="document.getElementById('dt-ia-modal').remove()"
        style="position:absolute;top:14px;right:14px;background:none;border:none;
               color:#aaa;font-size:20px;cursor:pointer">✕</button>
      <div style="font-size:32px;margin-bottom:10px">${g.ico}</div>
      <div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:8px">${g.titulo}</div>
      <div style="font-size:13px;color:#8899AA;line-height:1.6;margin-bottom:20px">${g.desc}</div>
      <div style="background:rgba(26,95,180,.15);border:1px solid rgba(26,95,180,.3);
                  border-radius:8px;padding:12px;font-size:12px;color:#7BB0E8;margin-bottom:20px">
        📥 La guía PDF estará disponible próximamente.<br>
        Puedes consultar recursos similares en el chat de WhatsApp de tu plan.
      </div>
      <button onclick="document.getElementById('dt-ia-modal').remove()"
        style="background:linear-gradient(135deg,#1A5FB4,#1565C0);color:#fff;border:none;
               padding:10px 24px;border-radius:8px;font-size:13px;font-weight:600;
               cursor:pointer;width:100%;font-family:var(--FC,'DM Sans',sans-serif)">
        Entendido
      </button>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

/* ─────────────────────────────────────────────
   7. INYECTAR SECCIÓN IA EN SIDEBAR
   ─────────────────────────────────────────────*/
function inyectarSidebarIA() {
  if (document.getElementById('seccion-ia')) return;

  // Buscar el nav del sidebar
  const nav = document.querySelector('aside nav, .sidebar nav, nav.sb-nav');
  if (!nav) return;

  const div = document.createElement('div');
  div.innerHTML = renderSeccionIA();
  nav.appendChild(div.firstElementChild);
}

/* ─────────────────────────────────────────────
   8. INTERCEPTAR mostrarResultado()
   Después de que el original dibuje los resultados,
   inyectamos el botón de solucionario.
   ─────────────────────────────────────────────*/
(function() {
  const originalMostrarResultado = window.mostrarResultado;
  if (typeof originalMostrarResultado !== 'function') {
    // Si aún no existe, esperar un tick
    setTimeout(() => {
      if (typeof window.mostrarResultado === 'function') {
        const orig = window.mostrarResultado;
        window.mostrarResultado = function() {
          orig.apply(this, arguments);
          setTimeout(inyectarBtnSolucionario, 100);
        };
      }
    }, 800);
    return;
  }
  window.mostrarResultado = function() {
    originalMostrarResultado.apply(this, arguments);
    setTimeout(inyectarBtnSolucionario, 100);
  };
})();

/* ─────────────────────────────────────────────
   9. INTERCEPTAR irA() para inyectar sidebar IA
   Cada vez que navegan al dashboard o a cualquier
   sección se asegura de que el bloque IA esté.
   ─────────────────────────────────────────────*/
(function() {
  const originalIrA = window.irA;
  if (typeof originalIrA === 'function') {
    window.irA = function(sec) {
      originalIrA.apply(this, arguments);
      setTimeout(inyectarSidebarIA, 200);
    };
  } else {
    setTimeout(() => {
      if (typeof window.irA === 'function') {
        const orig = window.irA;
        window.irA = function(sec) {
          orig.apply(this, arguments);
          setTimeout(inyectarSidebarIA, 200);
        };
      }
    }, 800);
  }
})();

/* ─────────────────────────────────────────────
   10. INICIALIZACIÓN
   ─────────────────────────────────────────────*/
document.addEventListener('DOMContentLoaded', () => {
  // Inyectar sidebar IA si ya hay sesión activa
  const docente = sessionStorage.getItem('docente');
  if (docente) {
    setTimeout(inyectarSidebarIA, 500);
  }
});

console.log('[DocentTics Mejoras v1.0] ✅ Cargado correctamente');
