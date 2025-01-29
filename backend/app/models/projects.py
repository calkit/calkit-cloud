"""Models related to projects."""

from pydantic import BaseModel

from app.models import Figure, Publication


class ShowcaseFigureInput(BaseModel):
    figure: str


class ShowcasePublicationInput(BaseModel):
    publication: str


class ShowcaseFigure(BaseModel):
    figure: Figure


class ShowcasePublication(BaseModel):
    publication: Publication


class ShowcaseText(BaseModel):
    text: str


class ShowcaseMarkdown(BaseModel):
    markdown: str


class ShowcaseInput(BaseModel):
    elements: list[
        ShowcaseFigureInput
        | ShowcasePublicationInput
        | ShowcaseText
    ]


class Showcase(BaseModel):
    elements: list[
        ShowcaseFigure
        | ShowcasePublication
        | ShowcaseText
    ]
