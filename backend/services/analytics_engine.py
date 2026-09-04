import sys
import json
import argparse
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import io
import base64

try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False

def forecast_sales(data):
    """
    Entrena un modelo de regresión lineal/ridge sobre datos de ventas diarias
    y predice las ventas para los próximos 30 días.
    """
    if not data or len(data) < 3:
        # Fallback si hay datos insuficientes
        return {
            "forecast": [],
            "message": "Se requieren al menos 3 días de datos históricos para generar pronósticos predictivos."
        }

    df = pd.DataFrame(data)
    df['date'] = pd.to_datetime(df['date'])
    df['amount'] = pd.to_numeric(df['amount'], errors='coerce').fillna(0)
    df = df.sort_values('date').reset_index(drop=True)

    # Crear feature temporal numérica (días transcurridos)
    min_date = df['date'].min()
    df['day_index'] = (df['date'] - min_date).dt.days

    X = df[['day_index']].values
    y = df['amount'].values

    # Entrenar modelo Ridge para evitar overfitting
    model = Ridge(alpha=1.0)
    model.fit(X, y)

    # Generar días futuros (próximos 30 días)
    last_day = df['day_index'].max()
    future_days = np.array([[last_day + i] for i in range(1, 31)])
    predictions = model.predict(future_days)
    predictions = np.clip(predictions, 0, None)  # Evitar valores negativos

    future_dates = [(df['date'].max() + pd.Timedelta(days=i)).strftime('%Y-%m-%d') for i in range(1, 31)]

    forecast_results = []
    for d, p in zip(future_dates, predictions):
        forecast_results.append({
            "date": d,
            "predicted_amount": round(float(p), 2)
        })

    total_predicted_revenue = round(float(np.sum(predictions)), 2)

    return {
        "historical_days": len(df),
        "total_predicted_30d": total_predicted_revenue,
        "daily_avg_predicted": round(total_predicted_revenue / 30.0, 2),
        "forecast": forecast_results
    }

def segment_customers(data):
    """
    Aplica K-Means Clustering sobre el historial de compras y reparaciones de los clientes
    para clasificarlos en segmentos (VIP, Frecuentes, En Riesgo, Nuevos).
    """
    if not data or len(data) < 4:
        return {
            "segments": [],
            "message": "Se requieren al menos 4 clientes con historial para ejecutar clustering K-Means."
        }

    df = pd.DataFrame(data)
    df['total_spent'] = pd.to_numeric(df['total_spent'], errors='coerce').fillna(0)
    df['total_orders'] = pd.to_numeric(df['total_orders'], errors='coerce').fillna(0)
    df['recency_days'] = pd.to_numeric(df['recency_days'], errors='coerce').fillna(999)

    X = df[['total_spent', 'total_orders', 'recency_days']].values
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    num_clusters = min(4, len(df))
    kmeans = KMeans(n_clusters=num_clusters, random_state=42, n_init=10)
    df['cluster'] = kmeans.fit_predict(X_scaled)

    # Mapeo de clusters a etiquetas según consumo promedio
    cluster_stats = df.groupby('cluster')['total_spent'].mean().sort_values(ascending=False)
    rank_map = {cluster_id: rank for rank, cluster_id in enumerate(cluster_stats.index)}
    
    labels_by_rank = {0: 'VIP', 1: 'Frecuente', 2: 'En Riesgo', 3: 'Ocasional/Nuevo'}
    df['segment_label'] = df['cluster'].map(lambda c: labels_by_rank.get(rank_map[c], 'Cliente'))

    results = []
    for _, row in df.iterrows():
        results.append({
            "customer_id": int(row['id']),
            "customer_name": str(row['name']),
            "total_spent": float(row['total_spent']),
            "total_orders": int(row['total_orders']),
            "segment": row['segment_label']
        })

    summary = df['segment_label'].value_counts().to_dict()

    return {
        "total_customers": len(df),
        "segment_summary": summary,
        "customers": results
    }

def generate_chart_png(data):
    """
    Genera un gráfico estático estilizado con Matplotlib en formato Base64 PNG
    para descargar en reportes oficiales.
    """
    if not HAS_MATPLOTLIB:
        return {"image_base64": None, "message": "matplotlib no está instalado en este sistema."}

    dates = [item['date'] for item in data.get('forecast', [])[:15]]
    amounts = [item['predicted_amount'] for item in data.get('forecast', [])[:15]]

    fig, ax = plt.subplots(figsize=(8, 4), facecolor='#0d0f17')
    ax.set_facecolor('#0d0f17')

    ax.plot(dates, amounts, color='#6366f1', marker='o', linewidth=2.5, label='Ventas Proyectadas ($)')
    ax.fill_between(dates, amounts, color='#6366f1', alpha=0.15)

    ax.set_title('Pronóstico Predictivo de Ventas (Scikit-Learn ML)', color='#ffffff', fontsize=14, pad=15)
    ax.set_xlabel('Fecha', color='#888888', fontsize=10)
    ax.set_ylabel('Ventas ($ MXN)', color='#888888', fontsize=10)
    ax.tick_params(colors='#888888', labelsize=9)
    plt.xticks(rotation=45)

    for spine in ax.spines.values():
        spine.set_color('#1e2330')

    ax.grid(True, linestyle='--', alpha=0.2, color='#ffffff')
    plt.tight_layout()

    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=150, facecolor=fig.get_facecolor(), edgecolor='none')
    buf.seek(0)
    image_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
    plt.close(fig)

    return {"image_base64": image_base64}

def main():
    parser = argparse.ArgumentParser(description="SySaaS ML & Analytics Engine")
    parser.add_argument('--action', required=True, choices=['forecast_sales', 'segment_customers', 'generate_chart_png', 'test'])
    parser.add_argument('--input', required=False, help="JSON Input String")

    args = parser.parse_args()

    if args.action == 'test':
        print(json.dumps({"status": "ok", "message": "SySaaS Analytics Engine Python OK"}))
        return

    input_data = {}
    if args.input:
        try:
            input_data = json.loads(args.input)
        except Exception as e:
            print(json.dumps({"error": f"Error al parsear entrada JSON: {str(e)}"}))
            sys.exit(1)

    if args.action == 'forecast_sales':
        res = forecast_sales(input_data)
        print(json.dumps(res))

    elif args.action == 'segment_customers':
        res = segment_customers(input_data)
        print(json.dumps(res))

    elif args.action == 'generate_chart_png':
        res = generate_chart_png(input_data)
        print(json.dumps(res))

if __name__ == '__main__':
    main()
