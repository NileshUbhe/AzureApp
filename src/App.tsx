import { ConfigProvider, theme } from 'antd';
import JsonDataGrid from './components/JsonDataGrid';

// Sample JSON data
const sampleData = Array.from({ length: 123 }).map((_, i) => {
  const status = i % 3 === 0 ? 'pending' : i % 3 === 1 ? 'active' : 'archived';
  const createdAt = new Date(Date.now() - i * 24 * 60 * 60 * 1000 + (i % 7) * 3600 * 1000);
  return {
    id: i + 1,
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    age: (i % 60) + 18,
    score: Math.round(Math.random() * 1000) / 10,
    isAdmin: i % 10 === 0,
    status,
    tags: ['tagA', 'tagB', 'tagC'].slice(0, (i % 3) + 1),
    createdAt,
    meta: { group: `G${i % 5}`, index: i }
  };
});

export default function App() {
  return (
    <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
      <div style={{ padding: 24 }}>
        <h2>JSON Data Grid Demo</h2>
        <p>Type-aware filters per column with paging, built on Ant Design Table.</p>
        <JsonDataGrid data={sampleData} pageSize={10} />
      </div>
    </ConfigProvider>
  );
}