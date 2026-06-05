[Setup]
AppName=AutoLecture for Maestro
AppVersion=1.4
UninstallDisplayName=AutoLecture for Maestro
SetupIconFile=LocalVoiceServer\icon.ico
UninstallDisplayIcon={app}\LocalVoiceServer\icon.ico
InfoBeforeFile=Welcome.txt
DefaultDirName={localappdata}\AutoLecture
DefaultGroupName=AutoLecture for Maestro
OutputDir=C:\Users\Jordan\Documents\AutoLecture
OutputBaseFilename=AutoLecture_for_Maestro_Setup_v1.4
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64

[Files]
Source: "VclStylesinno.dll"; DestDir: "{app}"; Flags: dontcopy
Source: "Carbon.vsf"; DestDir: "{app}"; Flags: dontcopy
Source: "C:\Users\Jordan\Documents\AutoLecture\LocalVoiceServer\dist\tray_app\*"; DestDir: "{app}\LocalVoiceServer"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "C:\Users\Jordan\Documents\AutoLecture\AutoLectureExtension\*"; DestDir: "{app}\ChromeExtension"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "C:\Users\Jordan\Documents\AutoLecture\Instructions.html"; DestDir: "{app}"; Flags: ignoreversion

[Tasks]
Name: "desktopicon"; Description: "Create Desktop Shortcut"; GroupDescription: "Additional icons:"; Flags: unchecked
Name: "startupicon"; Description: "Run AutoLecture at Windows startup"; GroupDescription: "Startup options:"

[Icons]
Name: "{group}\AutoLecture Voice Server"; Filename: "{app}\LocalVoiceServer\tray_app.exe"
Name: "{autostartup}\AutoLecture Voice Server"; Filename: "{app}\LocalVoiceServer\tray_app.exe"; Tasks: startupicon
Name: "{userdesktop}\AutoLecture Voice Server"; Filename: "{app}\LocalVoiceServer\tray_app.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\LocalVoiceServer\tray_app.exe"; Description: "Launch AutoLecture Server"; Flags: nowait postinstall skipifsilent
Filename: "{app}\Instructions.html"; Description: "View Chrome Extension Setup Instructions"; Flags: shellexec nowait postinstall skipifsilent

[Code]
procedure LoadVCLStyle(VClStyleFile: String); external 'LoadVCLStyleW@files:VclStylesinno.dll stdcall setuponly';
procedure UnLoadVCLStyles; external 'UnLoadVCLStyles@files:VclStylesinno.dll stdcall setuponly';

function InitializeSetup(): Boolean;
begin
  ExtractTemporaryFile('Carbon.vsf');
  LoadVCLStyle(ExpandConstant('{tmp}\Carbon.vsf'));
  Result := True;
end;

procedure DeinitializeSetup();
begin
  UnLoadVCLStyles;
end;
