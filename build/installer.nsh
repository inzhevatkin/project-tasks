!macro customInstall
  ; Keep the existing language when electron-updater installs a new version.
  ${ifNot} ${isUpdated}
    CreateDirectory "$APPDATA\project-tasks"
    FileOpen $0 "$APPDATA\project-tasks\installer-language.txt" w
    ${if} $LANGUAGE == ${LANG_RUSSIAN}
      FileWrite $0 "ru"
    ${elseIf} $LANGUAGE == ${LANG_SIMPCHINESE}
      FileWrite $0 "zh"
    ${else}
      FileWrite $0 "en"
    ${endIf}
    FileClose $0
  ${endIf}
!macroend
