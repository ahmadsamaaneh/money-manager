"""Start Money Manager with a clean-ready Excel file."""

from waitress import serve

import excel_db
from app import app

if __name__ == "__main__":
    excel_db._ensure_workbook()
    print("Money Manager running on http://127.0.0.1:5000")
    print("Password: 1110")
    serve(app, host="0.0.0.0", port=5000)
