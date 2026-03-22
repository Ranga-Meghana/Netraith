"""
Netraith - AI Cyber Threat Command Center
Flask Backend Entry Point
"""

from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
from config import Config

app = Flask(__name__)
app.config.from_object(Config)
CORS(app, resources={r"/api/*": {"origins": Config.ALLOWED_ORIGINS}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="gevent")
app.extensions["socketio"] = socketio

from database        import init_db
from firewall        import init_firewall_db
init_db()
init_firewall_db()

from routes.alerts          import alerts_bp
from routes.simulate        import simulate_bp
from routes.stats           import stats_bp
from routes.ai_analysis     import ai_bp       as ai_analysis_bp
from routes.ai_routes       import ai_bp       as ai_explain_bp
from routes.firewall_routes import firewall_bp
from routes.predict_routes  import predict_bp
from routes.report_routes   import report_bp
from services.suricata_watcher import SuricataWatcher
from routes.ingest_routes import ingest_bp

app.register_blueprint(alerts_bp,      url_prefix="/api/alerts")
app.register_blueprint(simulate_bp,    url_prefix="/api/simulate")
app.register_blueprint(stats_bp,       url_prefix="/api/stats")
app.register_blueprint(ai_analysis_bp, url_prefix="/api/ai-analysis")
app.register_blueprint(ai_explain_bp,  url_prefix="/api/ai")
app.register_blueprint(firewall_bp,    url_prefix="/api/firewall")
app.register_blueprint(predict_bp,     url_prefix="/api/predict")
app.register_blueprint(report_bp,      url_prefix="/api/report")
app.register_blueprint(ingest_bp, url_prefix="/api/alerts")

watcher = SuricataWatcher(socketio)
def start_watcher(): watcher.start()

@app.route("/api/health")
def health():
    return {"status": "ok", "service": "Netraith Backend"}, 200

@socketio.on("connect")
def on_connect(): print("[WS] Client connected")

@socketio.on("disconnect")
def on_disconnect(): print("[WS] Client disconnected")

if __name__ == "__main__":
    socketio.start_background_task(start_watcher)
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
