# Smartphone-Addiction-Warning-System

An end-to-end data science and web application project that predicts smartphone addiction risk levels based on user behavioral patterns and usage metrics, providing real-time warnings analytical insights and Recommendation .

---

## Table of Contents

1. [Overview](#overview)
2. [Dataset](#dataset)
3. [System Architecture](#system-architecture)
4. [Tech Stack](#tech-stack)
5. [Key Features](#key-features)
6. [Machine Learning Pipeline](#machine-learning-pipeline)
7. [Installation & Setup](#installation--setup)
8. [Project Structure](#project-structure)
9. [Usage & API Endpoints](#usage--api-endpoints)
10. [Model Evaluation & Performance](#model-evaluation--performance)
11. [License](#license)

---

## Overview

Excessive smartphone usage can lead to psychological and behavioral issues. The **Smartphone Addiction Warning System** aims to classify user behavior into distinct addiction risk tiers (e.g., Low, Moderate, High) using machine learning models. Built as a full-stack web application, it allows users or researchers to input mobile device interaction metrics and receive immediate risk evaluations along with actionable feedback.

---

## Dataset

The primary dataset used for model training and feature engineering is sourced from Kaggle:

* **Dataset Title:** Global Mobile Phone Addiction Dataset
* **Source:** [Kaggle Dataset Link](https://www.kaggle.com/datasets/khushikyad001/global-mobile-phone-addiction-dataset/code)
* **Features:** Includes parameters such as daily screen time, application usage frequencies, notification interactions, unlocking frequency, sleep disturbance indicators, and demographic indicators.

---

## System Architecture

The application is split into three main layers:

1. **Machine Learning & Analytics Layer:** Preprocessing, feature scaling, model selection, hyperparameter tuning, and serialization (`.pkl` / `.joblib`).
2. **Backend / API Layer:** RESTful API endpoints serving real-time model inference and data validation via FastAPI/Flask.
3. **Frontend Presentation Layer:** Interactive user interface for metric input, dynamic risk rendering, and visual analytics dashboards.

---

## Tech Stack

### Machine Learning & Data Science
* **Language:** Python 3.10+
* **Data Processing & Analysis:** Pandas, NumPy
* **Data Visualization:** Matplotlib, Seaborn
* **Model Building & Evaluation:** Scikit-Learn, XGBoost, LightGBM
* **Model Persistence:** Joblib / Pickle

### Web Backend
* **Framework:** FastAPI / Flask
* **API Architecture:** RESTful APIs
* **Server:** Uvicorn / Gunicorn
* **Environment Management:** Virtualenv / Conda

### Web Frontend
* **Core:** HTML5, CSS3, JavaScript (ES6+), React .. 
* **Framework / Library:** React.js / Streamlit
* **Data Visualization:** Chart.js / Plotly

### DevOps & Tooling
* **Version Control:** Git, GitHub
* **Containerization:** Docker
* **Dependency Management:** Pipenv / `requirements.txt`

---

## Key Features

* **Real-time Addiction Risk Assessment:** Instant evaluation based on input behavioral metrics.
* **Interactive Data Visualizations:** Visual dashboards illustrating individual metrics against benchmark thresholds.
* **Automated Warning System:** Threshold-triggered warnings indicating high-risk usage behavior.
* **Feature Importance Insights:** Model interpretability detailing top factors contributing to high addiction risk scores.

---

## Machine Learning Pipeline

1. **Data Ingestion & Cleaning:**
   * Missing value imputation.
   * Duplicate removal and anomaly detection.

2. **Feature Engineering & Preprocessing:**
   * Standardized numerical features using `StandardScaler` / `MinMaxScaler`.
   * One-hot / Label encoding for categorical variables.
   * Feature correlation analysis and selection.

3. **Model Selection & Training:**
   * Baseline comparison using Logistic Regression, Random Forest, and XGBoost Classifiers.
   * Hyperparameter optimization via `GridSearchCV` / `RandomizedSearchCV`.

4. **Inference Pipeline:**
   * Model export and integration into backend serving API.

---

## Installation & Setup

### Prerequisites
* Python 3.10 or higher
* Node.js & npm (if using React frontend)
* Git

### Step-by-Step Setup

1. **Clone the Repository:**
   ```bash
   git clone [https://github.com/your-username/smartphone-addiction-warning-system.git](https://github.com/your-username/smartphone-addiction-warning-system.git)
   cd smartphone-addiction-warning-system
