import { useEffect, useMemo, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import OrgChart from "./OrgChart.jsx";
import { buildIndex } from "./orgData.js";

export default function App() {
  const [root, setRoot] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/org.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setRoot)
      .catch((err) => setError(err.message));
  }, []);

  const index = useMemo(() => (root ? buildIndex(root) : null), [root]);

  if (error) return <p className="error">Failed to load org.json: {error}</p>;
  if (!index) return <p className="loading">Loading org chart…</p>;

  return (
    <ReactFlowProvider>
      <OrgChart index={index} />
    </ReactFlowProvider>
  );
}
