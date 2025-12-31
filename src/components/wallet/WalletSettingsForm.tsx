import React from 'react';
import type { EventWalletSettings } from '../../state/types';

interface WalletSettingsFormProps {
  settings: EventWalletSettings;
  onChange: (settings: EventWalletSettings) => void;
  compact?: boolean;
}

const WalletSettingsForm: React.FC<WalletSettingsFormProps> = ({
  settings,
  onChange,
  compact = false,
}) => {
  const handleChange = (key: keyof EventWalletSettings, value: any) => {
    onChange({ ...settings, [key]: value });
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-lg">💰</span>
          <span className="text-sm font-medium text-gray-700">Track Settlements</span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={settings.enabled}
            onChange={(e) => handleChange('enabled', e.target.checked)}
            title="Enable settlement tracking"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
        </label>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Enable/Disable */}
      <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200">
        <div>
          <p className="font-medium text-gray-800">Settlement Tracking</p>
          <p className="text-sm text-gray-500">Calculate who owes whom after the round</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={settings.enabled}
            onChange={(e) => handleChange('enabled', e.target.checked)}
            title="Enable settlement tracking"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
        </label>
      </div>

      {settings.enabled && (
        <>
          {/* Rounding Mode */}
          <div className="p-4 bg-white rounded-xl border border-gray-200">
            <p className="font-medium text-gray-800 mb-3">Rounding</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleChange('roundingMode', 'whole')}
                className={`p-3 rounded-lg border-2 text-center transition-colors ${
                  settings.roundingMode === 'whole'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <span className="block text-lg font-bold">$1</span>
                <span className="text-xs">Whole Dollar</span>
              </button>
              <button
                onClick={() => handleChange('roundingMode', 'half')}
                className={`p-3 rounded-lg border-2 text-center transition-colors ${
                  settings.roundingMode === 'half'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <span className="block text-lg font-bold">$0.50</span>
                <span className="text-xs">Half Dollar</span>
              </button>
            </div>
          </div>

          {/* Minimum Settlement */}
          <div className="p-4 bg-white rounded-xl border border-gray-200">
            <p className="font-medium text-gray-800 mb-3">Minimum Settlement</p>
            <p className="text-sm text-gray-500 mb-3">
              Amounts below this go to the tip fund (if enabled)
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[0.50, 1.00, 2.00].map((amount) => (
                <button
                  key={amount}
                  onClick={() => handleChange('minimumSettlement', amount)}
                  className={`p-3 rounded-lg border-2 text-center transition-colors ${
                    settings.minimumSettlement === amount
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span className="font-bold">${amount.toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tip Fund */}
          <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200">
            <div>
              <p className="font-medium text-gray-800">🎩 Tip Fund</p>
              <p className="text-sm text-gray-500">
                Collect rounded amounts for caddie tips
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                title="Enable tip fund"
                className="sr-only peer"
                checked={settings.tipFundEnabled}
                onChange={(e) => handleChange('tipFundEnabled', e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>
        </>
      )}
    </div>
  );
};

export default WalletSettingsForm;
