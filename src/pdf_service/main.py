import io
import json
from flask import Flask, request, send_file, render_template_string
import subprocess
import tempfile
import os
import typst

app = Flask(__name__)

# Minimal index.html als Template
INDEX_HTML = """
<!DOCTYPE html>
<html lang=\"de\">
<head>
    <meta charset=\"UTF-8\">
    <title>PDF Generator</title>
</head>
<body>
    <h1>PDF Generator</h1>
    <form action=\"/generate-pdf\" method=\"post\">
        Name: <input type=\"text\" name=\"name\" required>
        <button type=\"submit\">PDF generieren</button>
    </form>
</body>
</html>
"""

@app.route('/index', methods=['GET'])
def index():
    return render_template_string(INDEX_HTML)

sample_data = {
    "municipality": "Beispielstadt",
    "state": "Sachsen",
    "ranking": 43,
    "circular_barplot_values": {
        "energy": 20,
        "transport": 40,
        "ann": 60,
        "iec": 80,
        "bh": 15,
        "cpma": 100,
    },
    "progress": 22
}



@app.route('/generate-pdf', methods=['POST'])
def generate_pdf():
    name = request.form.get('name')
    if not name:
        return "Missing 'name' parameter", 400

    pdf_bytes = typst.compile("typst/municpality_overview.typ", font_paths=["typst/fonts"], sys_inputs={"data": json.dumps(sample_data)})
    pdf_stream = io.BytesIO(pdf_bytes)

    # PDF als Blob zurückgeben
    return send_file(pdf_stream, mimetype="application/pdf", as_attachment=False, download_name="output.pdf")

if __name__ == "__main__":
    typst.compile("typst/municpality_overview.typ", font_paths=["typst/fonts"], output="res.pdf", sys_inputs={"data": json.dumps(sample_data)})

    app.run(debug=True)
