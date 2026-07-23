# TYPST Document
The pdf document is compiled by the typst compiler.

## Development
Within ``municipality_summary.typ``, load the sample data by commenting the ..sys.input.. lines and uncomment the load sample data lines.

Install the recommended vscode extension for typst 'tinymist typst' to get a live preview from the document.

To create a pdf document, run 
```sh
typst compile municipality_summary.typ --font-path ./fonts
```

