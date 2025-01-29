"""Models related to projects."""

from pydantic import BaseModel

from app.models import Figure, Publication


class ProjectShowcaseFigureInput(BaseModel):
    figure: str


class ProjectShowcasePublicationInput(BaseModel):
    publication: str


class ProjectShowcaseFigure(BaseModel):
    figure: Figure


class ProjectShowcasePublication(BaseModel):
    publication: Publication


class ProjectShowcaseText(BaseModel):
    text: str


class ProjectShowcaseMarkdown(BaseModel):
    markdown: str


class ProjectShowcaseInput(BaseModel):
    elements: list[
        ProjectShowcaseFigureInput
        | ProjectShowcasePublicationInput
        | ProjectShowcaseText
    ]


class ProjectShowcase(BaseModel):
    elements: list[
        ProjectShowcaseFigure
        | ProjectShowcasePublication
        | ProjectShowcaseText
    ]
