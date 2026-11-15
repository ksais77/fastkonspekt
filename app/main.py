# Слой API: принимает запросы и отдаёт ответы.
# Здесь только склейка слоёв, своей логики в этом файле нет.

from fastapi import FastAPI, File, Request, UploadFile
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from app import extract, llm, storage

app = FastAPI(title="Свод — скелет")
templates = Jinja2Templates(directory="app/templates")


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    """Главная страница: форма загрузки и список обработанных документов."""
    return templates.TemplateResponse(
        request, "index.html", {"documents": storage.list_all(), "last": None}
    )


@app.post("/upload", response_class=HTMLResponse)
async def upload(request: Request, file: UploadFile = File(...)):
    """Путь одного запроса: файл -> текст -> модель -> сохранение -> страница."""
    data = await file.read()
    text = extract.extract_text(file.filename, data)  # слой обработки
    summary = llm.summarize(text)                      # слой модели
    doc = storage.save(file.filename, summary)         # слой хранения
    return templates.TemplateResponse(
        request, "index.html", {"documents": storage.list_all(), "last": doc}
    )


@app.post("/api/summarize")
async def api_summarize(file: UploadFile = File(...)):
    """Тот же путь, но ответ в JSON. Это и есть договорённость между фронтом и бэком."""
    data = await file.read()
    text = extract.extract_text(file.filename, data)
    summary = llm.summarize(text)
    doc = storage.save(file.filename, summary)
    return doc
