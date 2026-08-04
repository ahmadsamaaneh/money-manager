"""Money Manager — Flask web app with Excel storage."""

import os
from functools import wraps
from pathlib import Path

from flask import (
    Flask,
    jsonify,
    redirect,
    render_template,
    request,
    send_file,
    session,
    url_for,
)

import excel_db

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "money-manager-local-secret-key")
APP_PASSWORD = os.environ.get("APP_PASSWORD", "1110")

PUBLIC_ENDPOINTS = {"login", "login_post", "static"}


def _error(message: str, status: int = 400):
    return jsonify({"ok": False, "error": message}), status


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("authenticated"):
            if request.path.startswith("/api/"):
                return _error("يلزم تسجيل الدخول", 401)
            return redirect(url_for("login"))
        return view(*args, **kwargs)

    return wrapped


@app.before_request
def require_login():
    if request.endpoint in PUBLIC_ENDPOINTS or request.endpoint is None:
        return None
    if session.get("authenticated"):
        return None
    if request.path.startswith("/api/"):
        return _error("يلزم تسجيل الدخول", 401)
    return redirect(url_for("login"))


@app.get("/login")
def login():
    if session.get("authenticated"):
        return redirect(url_for("index"))
    return render_template("login.html")


@app.post("/login")
def login_post():
    password = (request.form.get("password") or "").strip()
    if password == APP_PASSWORD:
        session["authenticated"] = True
        return redirect(url_for("index"))
    return render_template("login.html", error="كلمة السر غلط"), 401


@app.post("/logout")
@login_required
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.get("/")
@login_required
def index():
    return render_template("index.html")


@app.get("/api/summary")
@login_required
def api_summary():
    return jsonify({"ok": True, "data": excel_db.get_summary()})


@app.get("/api/obligations")
@login_required
def api_obligations():
    return jsonify({"ok": True, "data": excel_db.list_obligations()})


@app.get("/api/notifications")
@login_required
def api_notifications():
    days = int(request.args.get("days", 7))
    return jsonify({"ok": True, "data": excel_db.get_notifications(days)})


@app.post("/api/deposit")
@login_required
def api_deposit():
    body = request.get_json(silent=True) or {}
    try:
        amount = float(body.get("amount", 0))
        name = str(body.get("name", "إيداع"))
        data = excel_db.deposit(amount, name)
        return jsonify({"ok": True, "data": data})
    except (TypeError, ValueError) as exc:
        return _error(str(exc))


@app.post("/api/balance")
@login_required
def api_set_balance():
    body = request.get_json(silent=True) or {}
    try:
        amount = float(body.get("amount", 0))
        note = str(body.get("note", "تصحيح رصيد"))
        data = excel_db.set_total_balance(amount, note)
        return jsonify({"ok": True, "data": data})
    except (TypeError, ValueError) as exc:
        return _error(str(exc))


@app.post("/api/expense")
@login_required
def api_expense():
    body = request.get_json(silent=True) or {}
    try:
        amount = float(body.get("amount", 0))
        name = str(body.get("name", ""))
        data = excel_db.add_expense(amount, name)
        return jsonify({"ok": True, "data": data})
    except (TypeError, ValueError) as exc:
        return _error(str(exc))


@app.post("/api/emergency")
@login_required
def api_emergency():
    body = request.get_json(silent=True) or {}
    try:
        amount = float(body.get("amount", 0))
        name = str(body.get("name", "سحب طوارئ"))
        data = excel_db.emergency_withdraw(amount, name)
        return jsonify({"ok": True, "data": data})
    except (TypeError, ValueError) as exc:
        return _error(str(exc))


@app.get("/api/loans")
@login_required
def api_loans():
    return jsonify({"ok": True, "data": excel_db.list_loans()})


@app.post("/api/loans")
@login_required
def api_add_loan():
    body = request.get_json(silent=True) or {}
    try:
        data = excel_db.add_loan(
            name=str(body.get("name", "")),
            amount=float(body.get("amount", 0)),
            mode=str(body.get("mode", "مرة واحدة")),
            period=str(body.get("period", "")),
            notes=str(body.get("notes", "")),
        )
        return jsonify({"ok": True, "data": data})
    except (TypeError, ValueError) as exc:
        return _error(str(exc))


@app.post("/api/loans/<int:loan_id>/repay")
@login_required
def api_repay_loan(loan_id: int):
    body = request.get_json(silent=True) or {}
    try:
        amount = float(body.get("amount", 0))
        data = excel_db.repay_loan(loan_id, amount)
        return jsonify({"ok": True, "data": data})
    except (TypeError, ValueError) as exc:
        return _error(str(exc))


@app.delete("/api/loans/<int:loan_id>")
@login_required
def api_delete_loan(loan_id: int):
    try:
        data = excel_db.delete_loan(loan_id)
        return jsonify({"ok": True, "data": data})
    except ValueError as exc:
        return _error(str(exc), 404)


@app.post("/api/daily-limit")
@login_required
def api_daily_limit():
    body = request.get_json(silent=True) or {}
    try:
        amount = float(body.get("amount", 0))
        data = excel_db.set_daily_limit(amount)
        return jsonify({"ok": True, "data": data})
    except (TypeError, ValueError) as exc:
        return _error(str(exc))


@app.post("/api/spend-budget")
@login_required
def api_spend_budget():
    body = request.get_json(silent=True) or {}
    try:
        amount = float(body.get("amount", 0))
        data = excel_db.set_spend_budget(amount)
        return jsonify({"ok": True, "data": data})
    except (TypeError, ValueError) as exc:
        return _error(str(exc))


@app.post("/api/obligations")
@login_required
def api_add_obligation():
    body = request.get_json(silent=True) or {}
    try:
        name = str(body.get("name", ""))
        amount = float(body.get("amount", 0))
        due_day = int(body.get("due_day", 1))
        notes = str(body.get("notes", ""))
        data = excel_db.add_obligation(name, amount, due_day, notes)
        return jsonify({"ok": True, "data": data})
    except (TypeError, ValueError) as exc:
        return _error(str(exc))


@app.delete("/api/obligations/<int:obligation_id>")
@login_required
def api_delete_obligation(obligation_id: int):
    try:
        data = excel_db.delete_obligation(obligation_id)
        return jsonify({"ok": True, "data": data})
    except ValueError as exc:
        return _error(str(exc), 404)


@app.post("/api/obligations/<int:obligation_id>/pay")
@login_required
def api_pay_obligation(obligation_id: int):
    try:
        data = excel_db.pay_obligation(obligation_id)
        return jsonify({"ok": True, "data": data})
    except (TypeError, ValueError) as exc:
        return _error(str(exc))


@app.get("/api/backup")
@login_required
def api_backup():
    excel_db._ensure_workbook()
    path = Path(excel_db.EXCEL_PATH)
    return send_file(
        path,
        as_attachment=True,
        download_name="money-backup.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


excel_db._ensure_workbook()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=os.environ.get("FLASK_DEBUG") == "1")
