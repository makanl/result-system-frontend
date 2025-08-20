import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Button,
  CircularProgress,
} from "@mui/material";

interface Assessment {
  id: number;
  student: number;
  ca_slot1: number | null;
  ca_slot2: number | null;
  ca_slot3: number | null;
  ca_slot4: number | null;
  exam_mark: number | null;
  // Add more fields if needed
}

const ResultDetailPage: React.FC = () => {
  const { courseId, resultId } = useParams<{
    courseId: string;
    resultId: string;
  }>();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchAssessments = async () => {
      try {
        const response = await api.get(
          `/result-system/courses/${courseId}/results/${resultId}/assessments/`
        );
        setAssessments(response.data.results); // or response.data if not paginated
      } catch {
        setError("Failed to load assessments.");
      } finally {
        setLoading(false);
      }
    };
    fetchAssessments();
  }, [courseId, resultId]);

  const handleInputChange = (
    id: number,
    field: keyof Assessment,
    value: string
  ) => {
    setAssessments((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, [field]: value === "" ? null : Number(value) } : a
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(
        assessments.map((a) =>
          api.patch(
            `/result-system/courses/${courseId}/results/${resultId}/assessments/${a.id}/`,
            {
              ca_slot1: a.ca_slot1,
              ca_slot2: a.ca_slot2,
              ca_slot3: a.ca_slot3,
              ca_slot4: a.ca_slot4,
              exam_mark: a.exam_mark,
            }
          )
        )
      );
      // Success handled by component state
    } catch (err) {
      console.error("Failed to save assessments:", err);
      // Error handling can be improved with proper state management
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <CircularProgress />;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", mt: 4 }}>
      <Typography variant="h5" gutterBottom>
        Assessments for Result #{resultId}
      </Typography>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Student ID</TableCell>
            <TableCell>CA Slot 1</TableCell>
            <TableCell>CA Slot 2</TableCell>
            <TableCell>CA Slot 3</TableCell>
            <TableCell>CA Slot 4</TableCell>
            <TableCell>Exam Mark</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {assessments.map((a) => (
            <TableRow key={a.id}>
              <TableCell>{a.student}</TableCell>
              <TableCell>
                <TextField
                  type="number"
                  value={a.ca_slot1 ?? ""}
                  onChange={(e) =>
                    handleInputChange(a.id, "ca_slot1", e.target.value)
                  }
                  size="small"
                  slotProps={{ input: { inputProps: { min: 0 } } }}
                />
              </TableCell>
              <TableCell>
                <TextField
                  type="number"
                  value={a.ca_slot2 ?? ""}
                  onChange={(e) =>
                    handleInputChange(a.id, "ca_slot2", e.target.value)
                  }
                  size="small"
                  slotProps={{ input: { inputProps: { min: 0 } } }}
                />
              </TableCell>
              <TableCell>
                <TextField
                  type="number"
                  value={a.ca_slot3 ?? ""}
                  onChange={(e) =>
                    handleInputChange(a.id, "ca_slot3", e.target.value)
                  }
                  size="small"
                  slotProps={{ input: { inputProps: { min: 0 } } }}
                />
              </TableCell>
              <TableCell>
                <TextField
                  type="number"
                  value={a.ca_slot4 ?? ""}
                  onChange={(e) =>
                    handleInputChange(a.id, "ca_slot4", e.target.value)
                  }
                  size="small"
                  slotProps={{ input: { inputProps: { min: 0 } } }}
                />
              </TableCell>
              <TableCell>
                <TextField
                  type="number"
                  value={a.exam_mark ?? ""}
                  onChange={(e) =>
                    handleInputChange(a.id, "exam_mark", e.target.value)
                  }
                  size="small"
                  slotProps={{ input: { inputProps: { min: 0 } } }}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button
        variant="contained"
        sx={{ mt: 2 }}
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "Saving..." : "Save"}
      </Button>
      <Button
        variant="contained"
        color="success"
        sx={{ mt: 2, ml: 2 }}
        onClick={async () => {
          try {
            await api.post(
              `/result-system/courses/${courseId}/results/${resultId}/submit/`,
              {}
            );
            // Success handled by component state
          } catch (err) {
            console.error("Failed to submit result:", err);
            // Error handling can be improved with proper state management
          }
        }}
      >
        Submit Result
      </Button>
    </Box>
  );
};

export default ResultDetailPage;
