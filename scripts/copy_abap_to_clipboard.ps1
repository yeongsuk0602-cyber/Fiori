$sourcePath = Join-Path $PSScriptRoot "..\abap\ESPERFOSET_CREATE_ENTITY.abap"
$text = [System.IO.File]::ReadAllText(
    [System.IO.Path]::GetFullPath($sourcePath),
    [System.Text.Encoding]::UTF8
)

Add-Type -AssemblyName PresentationCore
[System.Windows.Clipboard]::SetText($text)
