UPDATE "Institution" SET "gradingConfig" = '{
  "evaluationProcesses": [
    {
      "id": "proc-1",
      "name": "Cognitivo",
      "code": "COGNITIVO",
      "weightPercentage": 40,
      "order": 0,
      "allowTeacherAddGrades": false,
      "subprocesses": [
        { "id": "sub-1-1", "name": "Sub 1", "weightPercentage": 100, "numberOfGrades": 3, "order": 0 }
      ]
    },
    {
      "id": "proc-2",
      "name": "Procedimental",
      "code": "PROCEDIMENTAL",
      "weightPercentage": 40,
      "order": 1,
      "allowTeacherAddGrades": false,
      "subprocesses": [
        { "id": "sub-2-1", "name": "Sub 1", "weightPercentage": 100, "numberOfGrades": 3, "order": 0 }
      ]
    },
    {
      "id": "proc-3",
      "name": "Actitudinal",
      "code": "ACTITUDINAL",
      "weightPercentage": 20,
      "order": 2,
      "allowTeacherAddGrades": false,
      "subprocesses": [
        { "id": "sub-3-1", "name": "Personal", "weightPercentage": 25, "numberOfGrades": 1, "order": 0 },
        { "id": "sub-3-2", "name": "Social", "weightPercentage": 25, "numberOfGrades": 1, "order": 1 },
        { "id": "sub-3-3", "name": "Autoevaluación", "weightPercentage": 25, "numberOfGrades": 1, "order": 2 },
        { "id": "sub-3-4", "name": "Coevaluación", "weightPercentage": 25, "numberOfGrades": 1, "order": 3 }
      ]
    }
  ],
  "useFinalComponents": false,
  "finalComponents": [],
  "minPassingGrade": 3.0
}'::jsonb;

SELECT "gradingConfig" FROM "Institution" LIMIT 1;
