// Montage definitions for different viewing modes
// Each montage maps physical channels (0-7) to display labels

export const MONTAGES = {
  BANANA: {
    name: 'BANANA',
    labels: [
      'F3-P3',
      'P3-O1',
      'F3-T3',
      'T3-O1',
      'F4-P4',
      'P4-O2',
      'F4-T4',
      'T4-O2'
    ],
    description: 'Bipolar anterior-posterior montage'
  },
  '10-20': {
    name: '10-20',
    labels: [
      'F3',
      'P3',
      'T3',
      'O1',
      'F4',
      'P4',
      'T4',
      'O2'
    ],
    description: '10-20 system referential montage'
  },
  BIPOLAR: {
    name: 'BIPOLAR',
    labels: [
      'Fp1-F3',
      'F3-C3',
      'C3-P3',
      'P3-O1',
      'Fp2-F4',
      'F4-C4',
      'C4-P4',
      'P4-O2'
    ],
    description: 'Bipolar longitudinal montage'
  },
  REFERENCE: {
    name: 'REFERENCE',
    labels: [
      'F3-A1',
      'P3-A1',
      'T3-A1',
      'O1-A1',
      'F4-A2',
      'P4-A2',
      'T4-A2',
      'O2-A2'
    ],
    description: 'Referential montage (A1/A2 reference)'
  }
}

// Get channel label for a given montage and channel index
export function getChannelLabel(montage, channelIndex) {
  const montageConfig = MONTAGES[montage] || MONTAGES.BANANA
  return montageConfig.labels[channelIndex] || `Ch${channelIndex + 1}`
}

// Get all channel labels for a montage
export function getChannelLabels(montage) {
  const montageConfig = MONTAGES[montage] || MONTAGES.BANANA
  return montageConfig.labels
}

