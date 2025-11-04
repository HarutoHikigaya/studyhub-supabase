import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("docs");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-screen">Đang tải...</div>;

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-blue-600 text-white p-4 shadow-md">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold">📚 StudyHub.VN</h1>
            {user ? (
              <div className="flex items-center gap-4">
                <img src={user.user_metadata?.avatar_url || user.identities?.[0]?.identity_data?.avatar_url} alt="avatar" className="w-8 h-8 rounded-full" />
                <span className="font-medium">{user.user_metadata?.full_name || user.email}</span>
                <button onClick={() => supabase.auth.signOut()} className="bg-red-500 px-4 py-2 rounded hover:bg-red-600">
                  Đăng xuất
                </button>
              </div>
            ) : (
              <button onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })} className="bg-white text-blue-600 px-4 py-2 rounded font-medium hover:bg-gray-100">
                Đăng nhập Google
              </button>
            )}
          </div>
        </header>

        <div className="max-w-6xl mx-auto p-6">
          <div className="flex gap-2 mb-6 border-b">
            <button onClick={() => setActiveTab("docs")} className={`px-6 py-2 font-medium transition ${activeTab === "docs" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600"}`}>
              📄 Tài liệu
            </button>
            <button onClick={() => setActiveTab("qa")} className={`px-6 py-2 font-medium transition ${activeTab === "qa" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600"}`}>
              ❓ Hỏi đáp
            </button>
          </div>

          {activeTab === "docs" ? <Documents user={user} /> : <QA user={user} />}
        </div>
      </div>
    </Router>
  );
}

function Documents({ user }) {
  const [docs, setDocs] = useState([]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [file, setFile] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchDocs();
  }, []);

  const fetchDocs = async () => {
    const { data } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
    setDocs(data || []);
  };

  const handleUpload = async () => {
    if (!file || !title || !subject) return alert("Điền đủ thông tin!");
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const { data: uploadData, error: uploadError } = await supabase.storage.from('docs').upload(fileName, file);
    if (uploadError) return alert("Lỗi upload: " + uploadError.message);

    const { data: { publicUrl } } = supabase.storage.from('docs').getPublicUrl(fileName);

    const { error: insertError } = await supabase.from('documents').insert({
      title, subject, file_url: publicUrl, file_name: file.name, uploaded_by: user.user_metadata?.full_name || user.email
    });
    if (insertError) return alert("Lỗi lưu: " + insertError.message);

    alert("Đăng thành công!");
    setTitle(""); setSubject(""); setFile(null);
    fetchDocs();
  };

  const filteredDocs = docs.filter(d => 
    d.title.toLowerCase().includes(search.toLowerCase()) || d.subject.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {user && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-bold mb-4 text-blue-700">📤 Đăng tài liệu mới</h2>
          <input type="text" placeholder="Tên tài liệu" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-3 border rounded-lg mb-3" />
          <input type="text" placeholder="Môn học (VD: Toán)" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full p-3 border rounded-lg mb-3" />
          <input type="file" accept=".pdf,.docx,.pptx" onChange={(e) => setFile(e.target.files[0])} className="w-full p-3 border rounded-lg mb-3" />
          <button onClick={handleUpload} className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700">
            Đăng tài liệu
          </button>
        </div>
      )}
      <input type="text" placeholder="Tìm kiếm tài liệu..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full p-3 border rounded-lg mb-6 text-lg" />
      <div className="space-y-4">
        {filteredDocs.map((doc) => (
          <div key={doc.id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center hover:shadow-lg transition">
            <div>
              <h3 className="font-bold text-lg">{doc.title}</h3>
              <p className="text-sm text-gray-600">Môn: {doc.subject} • Đăng bởi: {doc.uploaded_by}</p>
            </div>
            <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700">
              Tải về
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

function QA({ user }) {
  const [questions, setQuestions] = useState([]);
  const [question, setQuestion] = useState("");
  const [image, setImage] = useState(null);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    const { data } = await supabase.from('questions').select('*').order('created_at', { ascending: false });
    setQuestions(data || []);
  };

  const handleAsk = async () => {
    if (!question.trim()) return alert("Nhập câu hỏi!");
    let imageUrl = "";
    if (image) {
      const fileName = `${crypto.randomUUID()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from('qa').upload(fileName, image);
      if (uploadError) return alert("Lỗi upload ảnh: " + uploadError.message);
      const { data: { publicUrl } } = supabase.storage.from('qa').getPublicUrl(fileName);
      imageUrl = publicUrl;
    }

    const { error } = await supabase.from('questions').insert({
      question, image_url: imageUrl, asked_by: user.user_metadata?.full_name || user.email, answers: []
    });
    if (error) return alert("Lỗi lưu: " + error.message);

    alert("Câu hỏi đã gửi!");
    setQuestion(""); setImage(null);
    fetchQuestions();
  };

  return (
    <div>
      {user && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-bold mb-4 text-green-700">❓ Đặt câu hỏi</h2>
          <textarea placeholder="Hỏi gì cũng được... (VD: Đáp án câu 5 môn Toán HK1)" value={question} onChange={(e) => setQuestion(e.target.value)} className="w-full p-3 border rounded-lg h-24 mb-3 resize-none" />
          <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files[0])} className="w-full p-3 border rounded-lg mb-3" />
          <button onClick={handleAsk} className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700">
            Gửi câu hỏi
          </button>
        </div>
      )}
      <div className="space-y-4">
        {questions.map((q) => (
          <div key={q.id} className="bg-white p-6 rounded-lg shadow">
            <p className="font-bold text-gray-800 mb-2">{q.question}</p>
            {q.image_url && <img src={q.image_url} alt="question image" className="max-w-md rounded-lg mb-2" />}
            <p className="text-sm text-gray-500">Hỏi bởi: {q.asked_by}</p>
            <div className="mt-3 p-3 bg-gray-50 rounded">
              <p className="text-sm italic text-gray-600">Chưa có trả lời. Bạn có thể trả lời dưới đây...</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
