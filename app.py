from flask import Flask, render_template, request, jsonify, send_file
import requests, re, math
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from flask import send_from_directory
import os

@app.route("/ads.txt")
def ads_txt():
    # serve static/ads.txt dalla cartella statica
    return send_from_directory(os.path.join(app.root_path, 'static'),
                               'ads.txt',
                               mimetype='text/plain')

app = Flask(__name__)

NAZIONI = [
    "Italy","Austria","Belgium","Bulgaria","Croatia","Cyprus","Czech_Republic",
    "Denmark","Estonia","Finland","France","Germany","Greece","Hungary",
    "Ireland","Latvia","Lithuania","Luxembourg","Malta","Netherlands",
    "Poland","Portugal","Romania","Slovakia","Slovenia","Spain","Sweden"
]

def fetch_rate(country):
    url = f"https://www.theglobaleconomy.com/{country}/mortgage_interest_rate/"
    resp = requests.get(url, timeout=5)
    resp.raise_for_status()
    text = resp.text
    # cerchiamo "recent value is <numero> percent"
    m = re.search(r"recent\s+value\s+is\s+([0-9]+(?:\.[0-9]+)?)\s+percent",
                  text, re.IGNORECASE)
    if not m:
        # per debug, salviamo un frammento di HTML in un file temporaneo
        with open("debug_rate.html", "w", encoding="utf-8") as f:
            f.write(text[:2000])
        raise ValueError("Tasso non trovato (html salvato in debug_rate.html)")
    return float(m.group(1))


def compute_plan(d):
    imp = d['importo'] - d['anticipo']
    t_mes = d['tasso']/100/12
    rate_tot = d['anni']*12
    quota_c = imp/rate_tot
    residuo = imp
    plan, tot_r, tot_c, tot_i = [], 0,0,0
    for n in range(1, rate_tot+1):
        if d['metodo']=="francese":
            rata = imp*(t_mes*(1+t_mes)**rate_tot)/((1+t_mes)**rate_tot-1)
        elif d['metodo']=="tedesco":
            rata = quota_c + residuo*t_mes
        else:  # italiano
            rata = quota_c + residuo*t_mes
        int_m = residuo*t_mes
        cap_m = rata-int_m if d['metodo']=="francese" else quota_c
        residuo -= cap_m
        tot_r += rata; tot_c += cap_m; tot_i += int_m
        plan.append([n, round(rata,2), round(cap_m,2), round(int_m,2), round(max(residuo,0),2)])
    return plan, (tot_r, tot_c, tot_i, round(max(residuo,0),2))

@app.route("/")
def index():
    return render_template("index.html", nazioni=NAZIONI)

@app.route("/get_rate")
def get_rate():
    try:
        r = fetch_rate(request.args.get("country").replace(" ","_"))
        return jsonify(success=True, rate=round(r,2))
    except Exception as e:
        return jsonify(success=False, error=str(e))

@app.route("/calculate", methods=["POST"])
def calculate():
    data = request.json
    plan, totals = compute_plan(data)
    return jsonify(plan=plan, totals=totals)

@app.route("/export_txt", methods=["POST"])
def export_txt():
    data = request.json
    plan, totals = compute_plan(data)
    lines = []
    hdr = f"{'N°':>4} {'Rata':>10} {'Cap':>10} {'Int':>10} {'Res':>10}"
    lines.append(hdr); lines.append("-"*len(hdr))
    for r in plan:
        lines.append(f"{r[0]:>4} {r[1]:10.2f} {r[2]:10.2f} {r[3]:10.2f} {r[4]:10.2f}")
    lines.append("-"*len(hdr))
    tr,tc,ti,dr = totals
    lines.append(f"{'Tot':>4} {tr:10.2f} {tc:10.2f} {ti:10.2f} {dr:10.2f}")
    bio = BytesIO(("\n".join(lines)).encode("utf-8"))
    return send_file(bio, as_attachment=True, download_name="piano_ammortamento.txt", mimetype="text/plain")

@app.route("/export_pdf", methods=["POST"])
def export_pdf():
    data = request.json
    plan, totals = compute_plan(data)
    tr,tc,ti,dr = totals
    bio = BytesIO()
    doc = SimpleDocTemplate(bio, pagesize=A4)
    styles = getSampleStyleSheet()
    elems = [Paragraph("Piano di Ammortamento", styles['Title']), Spacer(1,12)]
    table_data = [["N°","Rata","Cap","Int","Res"]]+[[str(r[0]),f"{r[1]:.2f}",f"{r[2]:.2f}",f"{r[3]:.2f}",f"{r[4]:.2f}"] for r in plan]
    table_data.append(["Tot",f"{tr:.2f}",f"{tc:.2f}",f"{ti:.2f}",f"{dr:.2f}"])
    tbl = Table(table_data, repeatRows=1)
    tbl.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),colors.lightgrey),
        ('BACKGROUND',(0,-1),(-1,-1),colors.lightgrey),
        ('GRID',(0,0),(-1,-1),0.5,colors.grey),
        ('ALIGN',(0,0),(-1,-1),'RIGHT'),
        ('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),
        ('FONTNAME',(0,-1),(-1,-1),'Helvetica-Bold'),
    ]))
    elems.append(tbl)
    doc.build(elems)
    bio.seek(0)
    return send_file(bio, as_attachment=True, download_name="piano_ammortamento.pdf", mimetype="application/pdf")

if __name__=="__main__":
    app.run(debug=True)
