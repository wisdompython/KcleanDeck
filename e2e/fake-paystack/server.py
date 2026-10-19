"""A tiny stand-in for the Paystack API, used only by the end-to-end tests.

Implements just what Kleandeck calls:
  POST /transaction/initialize     -> returns an authorization_url on this server
  GET  /transaction/verify/<ref>   -> returns the transaction's status
  GET  /checkout/<ref>             -> a fake payment page with Pay / Cancel buttons
  GET  /checkout/<ref>/pay|cancel  -> marks it, then redirects to the callback URL
  GET  /_transactions              -> JSON dump, for test assertions

State lives in memory; restart the container to reset it.
"""

import html
import json
import os
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlencode

PUBLIC_URL = os.environ.get("PUBLIC_URL", "http://localhost:8099").rstrip("/")
SECRET = os.environ.get("PAYSTACK_SECRET_KEY", "sk_test_e2e")
TRANSACTIONS: dict[str, dict] = {}


class Handler(BaseHTTPRequestHandler):
    def _json(self, status: int, body: dict) -> None:
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _authorized(self) -> bool:
        if self.headers.get("Authorization") != f"Bearer {SECRET}":
            self._json(401, {"status": False, "message": "Invalid key"})
            return False
        return True

    def _redirect(self, url: str) -> None:
        self.send_response(302)
        self.send_header("Location", url)
        self.end_headers()

    def do_POST(self):  # noqa: N802
        if self.path != "/transaction/initialize" or not self._authorized():
            if self.path != "/transaction/initialize":
                self._json(404, {"status": False, "message": "Not found"})
            return
        payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        ref = payload["reference"]
        TRANSACTIONS[ref] = {**payload, "status": "ongoing", "paid_at": None}
        self._json(200, {
            "status": True,
            "message": "Authorization URL created",
            "data": {"authorization_url": f"{PUBLIC_URL}/checkout/{ref}", "access_code": "fake", "reference": ref},
        })

    def do_GET(self):  # noqa: N802
        parts = [p for p in self.path.split("?")[0].split("/") if p]

        if parts == ["_transactions"]:
            return self._json(200, TRANSACTIONS)

        if len(parts) == 3 and parts[:2] == ["transaction", "verify"]:
            if not self._authorized():
                return
            txn = TRANSACTIONS.get(parts[2])
            if not txn:
                return self._json(404, {"status": False, "message": "Transaction reference not found"})
            return self._json(200, {"status": True, "data": {
                "reference": parts[2],
                "status": txn["status"],
                "amount": txn["amount"],
                "currency": txn.get("currency", "NGN"),
                "channel": "card",
                "paid_at": txn["paid_at"],
            }})

        if len(parts) >= 2 and parts[0] == "checkout" and parts[1] in TRANSACTIONS:
            ref, txn = parts[1], TRANSACTIONS[parts[1]]
            if len(parts) == 3 and parts[2] in {"pay", "cancel"}:
                if parts[2] == "pay":
                    txn["status"] = "success"
                    txn["paid_at"] = datetime.now(timezone.utc).isoformat()
                else:
                    txn["status"] = "abandoned"
                sep = "&" if "?" in txn["callback_url"] else "?"
                return self._redirect(f"{txn['callback_url']}{sep}{urlencode({'trxref': ref, 'reference': ref})}")

            amount = f"₦{txn['amount'] // 100:,}"
            page = f"""<!doctype html><meta charset="utf-8"><title>Fake Paystack</title>
<body style="font-family:sans-serif;max-width:420px;margin:60px auto;text-align:center">
<h1>Fake Paystack checkout</h1>
<p data-testid="amount">{html.escape(amount)}</p>
<p data-testid="email">{html.escape(txn['email'])}</p>
<p><a id="pay" href="/checkout/{ref}/pay">Pay {html.escape(amount)}</a></p>
<p><a id="cancel" href="/checkout/{ref}/cancel">Cancel payment</a></p>
</body>"""
            data = page.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        if parts == ["health"]:
            return self._json(200, {"ok": True})
        self._json(404, {"status": False, "message": "Not found"})

    def log_message(self, fmt, *args):
        print(f"[fake-paystack] {self.address_string()} {fmt % args}", flush=True)


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8099), Handler).serve_forever()
