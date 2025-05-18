document.addEventListener("DOMContentLoaded", () => {
  const elems = {
    redd1:    document.getElementById("redd1"),
    redd2:    document.getElementById("redd2"),
    chk13_1:  document.getElementById("chk13-1"),
    chk14_1:  document.getElementById("chk14-1"),
    chk13_2:  document.getElementById("chk13-2"),
    chk14_2:  document.getElementById("chk14-2"),
    tasso:    document.getElementById("tasso"),
    nazione:  document.getElementById("nazione"),
    labelMax: document.getElementById("label-max"),
    labelImp: document.getElementById("label-imp"),
    importo:  document.getElementById("importo"),
    anticipo: document.getElementById("anticipo"),
    anni:     document.getElementById("anni"),
    metodo:   document.getElementById("metodo"),
    tblBody:  document.querySelector("#plan-table tbody"),
    tfRata:   document.getElementById("tot-rata"),
    tfCap:    document.getElementById("tot-cap"),
    tfInt:    document.getElementById("tot-int"),
    tfRes:    document.getElementById("tot-res")
  };

  function redditoEff(val, tred, quat) {
    let r = parseFloat(val) || 0;
    if (quat) return r * 14/12;
    if (tred) return r * 13/12;
    return r;
  }

  function calcMax() {
    const r1 = redditoEff(elems.redd1.value, elems.chk13_1.checked, elems.chk14_1.checked);
    const r2 = redditoEff(elems.redd2.value, elems.chk13_2.checked, elems.chk14_2.checked);
    const rataMax = (r1 + r2) * 0.3;
    elems.labelMax.textContent = `Rata massima: ${rataMax.toFixed(2)} €/mese`;

    const t = parseFloat(elems.tasso.value) || 0;
    const tMes = t/100/12, mesi = 360;
    const impMax = tMes > 0
      ? rataMax * (1 - Math.pow(1 + tMes, -mesi)) / tMes
      : rataMax * mesi;
    elems.labelImp.textContent = `Importo mutuo max: ${impMax.toFixed(2)} €`;
  }

  function updateRate() {
    console.log("[updateRate] country:", elems.nazione.value);
    fetch(`/get_rate?country=${encodeURIComponent(elems.nazione.value)}`)
      .then(r => {
        console.log("[updateRate] raw response:", r);
        return r.json();
      })
      .then(j => {
        console.log("[updateRate] parsed JSON:", j);
        if (j.success) {
          elems.tasso.value = j.rate.toFixed(2);
          calcMax();
        } else {
          alert("Errore Aggiorna Tasso:\n" + j.error);
        }
      })
      .catch(err => {
        console.error("[updateRate] fetch error:", err);
        alert("Impossibile aggiornare il tasso:\ncontrolla la connessione Internet.");
      });
  }



  function validateAmmo() {
    if (isNaN(parseFloat(elems.importo.value))) {
      alert("Errore Importo:\nInserisci un numerico valido per il prezzo dell'immobile.");
      return false;
    }
    if (isNaN(parseFloat(elems.tasso.value))) {
      alert("Errore Tasso:\nInserisci un numerico valido per il tasso di interesse.");
      return false;
    }
    if (isNaN(parseInt(elems.anni.value,10))) {
      alert("Errore Durata:\nInserisci un intero valido per la durata in anni.");
      return false;
    }
    if (elems.anticipo.value !== "" && isNaN(parseFloat(elems.anticipo.value))) {
      alert("Errore Anticipo:\nInserisci un numerico valido per l'anticipo.");
      return false;
    }
    return true;
  }

  function calculatePlan() {
    if (!validateAmmo()) return;
    const payload = {
      importo:  parseFloat(elems.importo.value),
      anticipo: parseFloat(elems.anticipo.value) || 0,
      anni:     parseInt(elems.anni.value,10),
      tasso:    parseFloat(elems.tasso.value),
      metodo:   elems.metodo.value
    };
    fetch("/calculate", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload)
    })
    .then(r=>r.json())
    .then(j=>{
      elems.tblBody.innerHTML = "";
      j.plan.forEach(([n,rata,cap,int,res])=>{
        const tr = document.createElement("tr");
        [n, rata, cap, int, res].forEach((v,i)=>{
          const td=document.createElement("td");
          td.textContent = i===0 ? v : v.toFixed(2);
          td.className = i===0?"":"text-end";
          tr.appendChild(td);
        });
        elems.tblBody.appendChild(tr);
      });
      [elems.tfRata, elems.tfCap, elems.tfInt, elems.tfRes].forEach((el,i)=>{
        el.textContent = j.totals[i].toFixed(2);
      });
      
      // ==== SCROLL SMOOTH VERSO LA TABELLA ====
      const tableContainer = document.getElementById("table-container");
      if (tableContainer) {
        tableContainer.scrollIntoView({ behavior: "smooth" });
      }
    });
  }

  function exportPDF() {
    if (!validateAmmo()) return;
    const payload = {
      importo:  parseFloat(elems.importo.value),
      anticipo: parseFloat(elems.anticipo.value)||0,
      anni:     parseInt(elems.anni.value,10),
      tasso:    parseFloat(elems.tasso.value),
      metodo:   elems.metodo.value
    };
    fetch("/export_pdf", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload)
    })
    .then(r=>r.blob())
    .then(blob=>{
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url; a.download="piano_ammortamento.pdf"; a.click();
      URL.revokeObjectURL(url);
    });
  }

  function showInfo() {
    new bootstrap.Modal(document.getElementById("infoModal")).show();
  }

  // listeners
  ["redd1","redd2","chk13-1","chk14-1","chk13-2","chk14-2","tasso"]
    .forEach(id=>document.getElementById(id).addEventListener("input",calcMax));
  document.getElementById("btn-rate").addEventListener("click",updateRate);
  document.getElementById("btn-calc").addEventListener("click",calculatePlan);
  document.getElementById("btn-pdf").addEventListener("click",exportPDF);
  document.getElementById("btn-info").addEventListener("click",showInfo);

  // init
  calcMax();
});
