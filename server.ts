import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  scoreSingleRecord,
  getAvailableModels,
  getCohortStatistics,
  RULES,
  BAND_CUTS,
  BAND_LABELS,
} from './server/engine';
import { RawRecord, ModelType } from './src/types';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      model_loaded: true,
      default_model: 'gb',
      version: '1.0',
    });
  });

  app.get('/api/models', (_req, res) => {
    const models = getAvailableModels();
    res.json({
      available: models.map((m) => m.id),
      default: 'gb',
      models,
    });
  });

  app.get('/api/rules', (_req, res) => {
    res.json({
      rules: RULES,
      cuts: BAND_CUTS,
      bands: BAND_LABELS,
    });
  });

  app.get('/api/cohort-stats', (_req, res) => {
    res.json(getCohortStatistics());
  });

  app.post('/api/predict', (req, res) => {
    try {
      const { records, model = 'gb', tips = 3 } = req.body;

      if (!records || !Array.isArray(records) || records.length === 0) {
        return res.status(422).json({ detail: 'At least one record is required in `records` array.' });
      }

      const modelName = (model as ModelType) || 'gb';
      const results = records.map((record: RawRecord) => scoreSingleRecord(record, modelName, Number(tips) || 3));

      return res.json({
        results,
        count: results.length,
        model_used: modelName,
        tips: Number(tips) || 3,
      });
    } catch (err: any) {
      console.error('Error during prediction:', err);
      return res.status(500).json({ detail: err.message || 'Internal error processing prediction.' });
    }
  });

  // Sample Preset Cohort Records for Quick Testing
  app.get('/api/preset-samples', (_req, res) => {
    const samples: Array<{ name: string; description: string; record: RawRecord }> = [
      {
        name: 'Shannon F. (Severe / High Gaming)',
        description: 'Age 13, 4h daily phone use, 8.7h weekend use, 1.4h before bed, low sleep.',
        record: {
          Age: 13,
          Gender: 'Female',
          School_Grade: '9th',
          Daily_Usage_Hours: 4.0,
          Sleep_Hours: 6.1,
          Academic_Performance: 78,
          Social_Interactions: 5,
          Exercise_Hours: 0.1,
          Anxiety_Level: 10,
          Depression_Level: 3,
          Self_Esteem: 8,
          Parental_Control: 0,
          Screen_Time_Before_Bed: 1.4,
          Phone_Checks_Per_Day: 86,
          Apps_Used_Daily: 19,
          Time_on_Social_Media: 3.6,
          Time_on_Gaming: 1.7,
          Time_on_Education: 1.2,
          Family_Communication: 4,
          Weekend_Usage_Hours: 8.7,
        },
      },
      {
        name: 'Scott R. (High Screen Time & Sleep Deficit)',
        description: 'Age 17, 5.5h daily phone use, 0 exercise hours, high gaming 4h, high depression index.',
        record: {
          Age: 17,
          Gender: 'Female',
          School_Grade: '7th',
          Daily_Usage_Hours: 5.5,
          Sleep_Hours: 6.5,
          Academic_Performance: 70,
          Social_Interactions: 5,
          Exercise_Hours: 0.0,
          Anxiety_Level: 3,
          Depression_Level: 7,
          Self_Esteem: 3,
          Parental_Control: 0,
          Screen_Time_Before_Bed: 0.9,
          Phone_Checks_Per_Day: 96,
          Apps_Used_Daily: 9,
          Time_on_Social_Media: 1.1,
          Time_on_Gaming: 4.0,
          Time_on_Education: 1.8,
          Family_Communication: 2,
          Weekend_Usage_Hours: 5.3,
        },
      },
      {
        name: 'Adrian K. (Moderate / Educational Skew)',
        description: 'Age 13, 5.8h daily phone use, 137 checks/day, high family communication & 8h sleep.',
        record: {
          Age: 13,
          Gender: 'Other',
          School_Grade: '11th',
          Daily_Usage_Hours: 5.8,
          Sleep_Hours: 5.5,
          Academic_Performance: 93,
          Social_Interactions: 8,
          Exercise_Hours: 0.8,
          Anxiety_Level: 2,
          Depression_Level: 3,
          Self_Esteem: 10,
          Parental_Control: 0,
          Screen_Time_Before_Bed: 0.5,
          Phone_Checks_Per_Day: 137,
          Apps_Used_Daily: 8,
          Time_on_Social_Media: 0.3,
          Time_on_Gaming: 1.5,
          Time_on_Education: 0.4,
          Family_Communication: 6,
          Weekend_Usage_Hours: 5.7,
        },
      },
      {
        name: 'Elena V. (Healthy / Balanced Usage)',
        description: 'Age 15, 2.0h daily phone use, 8.5h sleep, high exercise & family communication, parental limits active.',
        record: {
          Age: 15,
          Gender: 'Female',
          School_Grade: '10th',
          Daily_Usage_Hours: 2.0,
          Sleep_Hours: 8.5,
          Academic_Performance: 92,
          Social_Interactions: 8,
          Exercise_Hours: 2.0,
          Anxiety_Level: 2,
          Depression_Level: 1,
          Self_Esteem: 9,
          Parental_Control: 1,
          Screen_Time_Before_Bed: 0.2,
          Phone_Checks_Per_Day: 35,
          Apps_Used_Daily: 6,
          Time_on_Social_Media: 0.8,
          Time_on_Gaming: 0.4,
          Time_on_Education: 0.8,
          Family_Communication: 8,
          Weekend_Usage_Hours: 2.5,
        },
      },
    ];

    res.json({ samples });
  });

  // Vite Middleware / Static Files
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Smartphone Addiction Warning System] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
