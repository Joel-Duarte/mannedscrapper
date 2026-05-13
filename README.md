# MannedScrapper
Lil click and select scrapper to send data to custom endpoints

Captured data is sent in a structured JSON format with link extraction and simple text cleaning:

```json
{
  "id": "uuid-v4",
  "text": "The main content of your selection without messy formatting.",
  "tagName": "DIV",
  "links": [
    { "text": "Click Here", "url": "[https://example.com/page](https://example.com/page)" }
  ],
  "metadata": {
    "source_url": "[https://source.com](https://source.com)",
    "page_title": "Page Title",
    "timestamp": "2026-05-13T18:12:12Z"
  }
}