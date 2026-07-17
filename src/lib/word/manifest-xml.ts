const WORD_ADDIN_ID = "b4e8f1a2-6c3d-4e5f-8a9b-0c1d2e3f4a5b";
const MANIFEST_VERSION = "1.0.0.0";

export function buildWordManifestXml(base: string) {
  const domain = base.replace(/^https?:\/\//, "");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bt="http://schemas.microsoft.com/office/officeappbasictypes/1.0"
  xmlns:ov="http://schemas.microsoft.com/office/taskpaneappversionoverrides"
  xsi:type="TaskPaneApp">
  <Id>${WORD_ADDIN_ID}</Id>
  <Version>${MANIFEST_VERSION}</Version>
  <ProviderName>Chantier App</ProviderName>
  <DefaultLocale>fr-FR</DefaultLocale>
  <DisplayName DefaultValue="Chantier App - Documents"/>
  <Description DefaultValue="Inserer et remplir les etiquettes OS / acte d'engagement depuis la base chantier."/>
  <IconUrl DefaultValue="${base}/icons/icon-192.png"/>
  <HighResolutionIconUrl DefaultValue="${base}/icons/icon-512.png"/>
  <SupportUrl DefaultValue="${base}/pc"/>
  <AppDomains>
    <AppDomain>${domain}</AppDomain>
  </AppDomains>
  <Hosts>
    <Host Name="Document"/>
  </Hosts>
  <DefaultSettings>
    <SourceLocation DefaultValue="${base}/word/taskpane"/>
  </DefaultSettings>
  <Permissions>ReadWriteDocument</Permissions>
  <VersionOverrides xmlns="http://schemas.microsoft.com/office/taskpaneappversionoverrides" xmlns:bt="http://schemas.microsoft.com/office/officeappbasictypes/1.0" xsi:type="VersionOverridesV1_0">
    <Hosts>
      <Host xsi:type="Document">
        <DesktopFormFactor>
          <GetStarted>
            <Title resid="GetStarted.Title"/>
            <Description resid="GetStarted.Description"/>
            <LearnMoreUrl resid="GetStarted.LearnMoreUrl"/>
          </GetStarted>
          <ExtensionPoint xsi:type="PrimaryCommandSurface">
            <OfficeTab id="TabHome">
              <Group id="ChantierAppWordGroup">
                <Label resid="Group.Label"/>
                <Icon>
                  <bt:Image size="16" resid="Icon.16"/>
                  <bt:Image size="32" resid="Icon.32"/>
                  <bt:Image size="80" resid="Icon.80"/>
                </Icon>
                <Control xsi:type="Button" id="WordLabelsButton">
                  <Label resid="TaskpaneButton.Label"/>
                  <Supertip>
                    <Title resid="TaskpaneButton.Title"/>
                    <Description resid="TaskpaneButton.Description"/>
                  </Supertip>
                  <Icon>
                    <bt:Image size="16" resid="Icon.16"/>
                    <bt:Image size="32" resid="Icon.32"/>
                    <bt:Image size="80" resid="Icon.80"/>
                  </Icon>
                  <Action xsi:type="ShowTaskpane">
                    <TaskpaneId>ChantierWordTaskpane</TaskpaneId>
                    <SourceLocation resid="Taskpane.Url"/>
                  </Action>
                </Control>
              </Group>
            </OfficeTab>
          </ExtensionPoint>
        </DesktopFormFactor>
      </Host>
    </Hosts>
    <Resources>
      <bt:Images>
        <bt:Image id="Icon.16" DefaultValue="${base}/icons/icon-192.png"/>
        <bt:Image id="Icon.32" DefaultValue="${base}/icons/icon-192.png"/>
        <bt:Image id="Icon.80" DefaultValue="${base}/icons/icon-512.png"/>
      </bt:Images>
      <bt:Urls>
        <bt:Url id="Taskpane.Url" DefaultValue="${base}/word/taskpane"/>
        <bt:Url id="GetStarted.LearnMoreUrl" DefaultValue="${base}/pc"/>
      </bt:Urls>
      <bt:ShortStrings>
        <bt:String id="Group.Label" DefaultValue="Chantier App"/>
        <bt:String id="TaskpaneButton.Label" DefaultValue="Etiquettes"/>
        <bt:String id="TaskpaneButton.Title" DefaultValue="Etiquettes chantier"/>
        <bt:String id="GetStarted.Title" DefaultValue="Chantier App - Documents"/>
      </bt:ShortStrings>
      <bt:LongStrings>
        <bt:String id="TaskpaneButton.Description" DefaultValue="Inserer des etiquettes et remplir le document Word avec les donnees du chantier."/>
        <bt:String id="GetStarted.Description" DefaultValue="Placez des etiquettes dans votre modele Word puis remplissez-les depuis la base."/>
      </bt:LongStrings>
    </Resources>
  </VersionOverrides>
</OfficeApp>`;
}
