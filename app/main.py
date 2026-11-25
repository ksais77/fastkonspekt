# Слой API: принимает запросы и отдаёт ответы.
# Здесь только склейка слоёв, своей логики в этом файле нет.

import httpx
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from app import extract, llm, storage

app = FastAPI(title="Свод — скелет")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="app/templates")


class TextIn(BaseModel):
    text: str
    length: str = "short"
    structure: str = "theses"

def summarize_or_error(text: str, length: str = "short", structure: str = "theses") -> str:
    """Общая проверка и вызов модели для файла и для текста."""
    if not text.strip():
        raise HTTPException(status_code=400, detail="Пустой текст")
    try:
        return llm.summarize(text, length, structure)
    except httpx.HTTPError as error:
        print("Ошибка Ollama:", repr(error), flush=True)
        raise HTTPException(
            status_code=503, detail="Сервис не отвечает, повторите позже"
        )
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
    summary = summarize_or_error(text)                 # слой модели
    doc = storage.save(file.filename, summary)         # слой хранения
    return templates.TemplateResponse(
        request, "index.html", {"documents": storage.list_all(), "last": doc}
    )


@app.post("/upload-text", response_class=HTMLResponse)
def upload_text(request: Request, text: str = Form(...)):
    """Текст из формы на странице -> модель -> сохранение -> страница."""
    summary = summarize_or_error(text)
    doc = storage.save("Текст из формы", summary)
    return templates.TemplateResponse(
        request, "index.html", {"documents": storage.list_all(), "last": doc}
    )


@app.get("/api/model-check")
def model_check():
    answer = llm.ask_model("Ответь одним словом: ты работаешь?")
    return {"model_answer": answer}


@app.post("/api/summarize")
async def api_summarize(file: UploadFile = File(...), length: str = "short", structure: str = "theses"):
    """Тот же путь, но ответ в JSON. Это и есть договорённость между фронтом и бэком."""
    data = file.file.read()
    text = extract.extract_text(file.filename, data)
    summary = summarize_or_error(text, length, structure)
    storage.save(file.filename, summary)
    return {"title": file.filename, "summary": summary}

@app.post("/api/summarize-text")
def api_summarize_text(body: TextIn):
    """Текст из JSON -> модель -> сохранение -> JSON."""
    summary = summarize_or_error(body.text, body.length, body.structure)
    storage.save("Текст из запроса", summary)
    return {"title": "Вставленный текст", "summary": summary}