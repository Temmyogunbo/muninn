"""Lambda handler for the FastAPI application."""

from mangum import Mangum

try:
    from api.main import app
except ImportError:
    from main import app

handler = Mangum(app, lifespan="off")