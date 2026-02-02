import { SettingsPage } from '../components';
import { useAppContext } from '../contexts/AppContext';

export function SettingsPageView() {
  const { settings, onSaveSettings } = useAppContext();

  return (
    <div className="h-full overflow-y-auto">
      <SettingsPage settings={settings} onSaveSettings={onSaveSettings} />
    </div>
  );
}
