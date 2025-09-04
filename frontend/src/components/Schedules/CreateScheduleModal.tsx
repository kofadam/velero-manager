import React, { useState, useEffect } from 'react';
import Modal from '../Common/Modal.tsx';
import { apiService } from '../../services/api.ts';
import {
  CRON_PRESETS,
  translateCronExpression,
  validateCronExpression,
} from '../../utils/cronUtils.ts';
import './CreateScheduleModal.css';

interface CreateScheduleModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const CreateScheduleModal: React.FC<CreateScheduleModalProps> = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    schedule: '',
    includedNamespaces: '',
    excludedNamespaces: '',
    storageLocation: 'default',
    ttl: '720h0m0s',
    paused: false,
  });
  const [cronTranslation, setCronTranslation] = useState('');
  const [cronError, setCronError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    updateCronTranslation(formData.schedule);
  }, [formData.schedule]);

  const updateCronTranslation = (cronExpression: string) => {
    if (!cronExpression.trim()) {
      setCronTranslation('');
      setCronError('');
      return;
    }

    const validation = validateCronExpression(cronExpression);
    if (!validation.isValid) {
      setCronError(validation.error || 'Invalid cron expression');
      setCronTranslation('');
    } else {
      setCronError('');
      setCronTranslation(translateCronExpression(cronExpression));
    }
  };

  const handlePresetSelect = (preset: any) => {
    setFormData((prev) => ({ ...prev, schedule: preset.expression }));
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const validation = validateCronExpression(formData.schedule);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid cron expression');
      setLoading(false);
      return;
    }

    try {
      const namespaces = formData.includedNamespaces
        .split(',')
        .map((ns) => ns.trim())
        .filter((ns) => ns.length > 0);

      const excludedNamespaces = formData.excludedNamespaces
        .split(',')
        .map((ns) => ns.trim())
        .filter((ns) => ns.length > 0);

      await apiService.createSchedule({
        name: formData.name,
        schedule: formData.schedule,
        includedNamespaces: namespaces.length > 0 ? namespaces : undefined,
        excludedNamespaces: excludedNamespaces.length > 0 ? excludedNamespaces : undefined,
        storageLocation: formData.storageLocation,
        ttl: formData.ttl,
        paused: formData.paused,
      });

      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to create schedule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="⏰ Create Backup Schedule" onClose={onClose} size="large">
      <form onSubmit={handleSubmit} className="create-schedule-form">
        {/* Basic Info Section */}
        <div className="form-section">
          <h3>📋 Basic Information</h3>

          <div className="form-group">
            <label htmlFor="schedule-name">Schedule Name *</label>
            <input
              id="schedule-name"
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="daily-backup-schedule"
              required
              disabled={loading}
            />
          </div>
        </div>

        {/* Schedule Section */}
        <div className="form-section">
          <h3>⏰ Schedule Configuration</h3>

          {/* Preset Buttons */}
          <div className="presets-section">
            <label>Quick Presets:</label>
            <div className="preset-buttons">
              {CRON_PRESETS.map((preset, index) => (
                <button
                  key={index}
                  type="button"
                  className={`preset-btn ${
                    formData.schedule === preset.expression ? 'active' : ''
                  }`}
                  onClick={() => handlePresetSelect(preset)}
                  disabled={loading}
                >
                  <span className="preset-icon">{preset.icon}</span>
                  <span className="preset-label">{preset.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Cron Input */}
          <div className="form-group">
            <label htmlFor="cron-schedule">
              Cron Expression *
              <span className="help-link">
                <a href="https://crontab.guru/" target="_blank" rel="noopener noreferrer">
                  Need help? 🔗
                </a>
              </span>
            </label>
            <input
              id="cron-schedule"
              type="text"
              value={formData.schedule}
              onChange={(e) => handleChange('schedule', e.target.value)}
              placeholder="0 2 * * * (minute hour day month weekday)"
              required
              disabled={loading}
              className={cronError ? 'error' : ''}
            />
            {cronTranslation && (
              <div className="cron-translation">
                ✅ <strong>Schedule:</strong> {cronTranslation}
              </div>
            )}
            {cronError && <div className="cron-error">❌ {cronError}</div>}
            <small>Format: minute(0-59) hour(0-23) day(1-31) month(1-12) weekday(0-7)</small>
          </div>
        </div>

        {/* Backup Scope Section */}
        <div className="form-section">
          <h3>🎯 Backup Scope</h3>

          <div className="form-group">
            <label htmlFor="included-namespaces">Included Namespaces</label>
            <input
              id="included-namespaces"
              type="text"
              value={formData.includedNamespaces}
              onChange={(e) => handleChange('includedNamespaces', e.target.value)}
              placeholder="default, app-namespace (or * for all)"
              disabled={loading}
            />
            <small>Comma-separated list of namespaces to include</small>
          </div>

          <div className="form-group">
            <label htmlFor="excluded-namespaces">Excluded Namespaces</label>
            <input
              id="excluded-namespaces"
              type="text"
              value={formData.excludedNamespaces}
              onChange={(e) => handleChange('excludedNamespaces', e.target.value)}
              placeholder="kube-system, velero"
              disabled={loading}
            />
            <small>Comma-separated list of namespaces to exclude</small>
          </div>
        </div>

        {/* Advanced Options Section */}
        <div className="form-section">
          <h3>⚙️ Advanced Options</h3>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="storage-location">Storage Location</label>
              <input
                id="storage-location"
                type="text"
                value={formData.storageLocation}
                onChange={(e) => handleChange('storageLocation', e.target.value)}
                placeholder="default"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="ttl">TTL (Time to Live)</label>
              <input
                id="ttl"
                type="text"
                value={formData.ttl}
                onChange={(e) => handleChange('ttl', e.target.value)}
                placeholder="720h0m0s"
                disabled={loading}
              />
              <small>How long to keep backups (e.g., 720h0m0s = 30 days)</small>
            </div>
          </div>

          <div className="checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.paused}
                onChange={(e) => handleChange('paused', e.target.checked)}
                disabled={loading}
              />
              <span>Start Paused</span>
            </label>
            <small>Create the schedule in paused state (can be enabled later)</small>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={loading || !!cronError}>
            {loading ? 'Creating...' : '⏰ Create Schedule'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateScheduleModal;
