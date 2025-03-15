import { useState } from 'react';
import QRCode from 'react-qr-code';
import { ReclaimProofRequest } from '@reclaimprotocol/js-sdk';
 
function ReclaimDemo() {
  const [requestUrl, setRequestUrl] = useState('');
  const [proofs, setProofs] = useState(null);
  const [isVerified, setIsVerified] = useState(false);
  const [userData, setUserData] = useState(null);
 
  const getVerificationReq = async () => {
    // 環境変数から認証情報を取得
    const APP_ID = process.env.REACT_APP_RECLAIM_APP_ID;
    const APP_SECRET = process.env.REACT_APP_RECLAIM_APP_SECRET;
    const PROVIDER_ID = process.env.REACT_APP_RECLAIM_PROVIDER_ID;

    if (!APP_ID || !APP_SECRET || !PROVIDER_ID) {
      console.error('環境変数が設定されていません');
      return;
    }

    // Reclaim SDKを認証情報で初期化
    const reclaimProofRequest = await ReclaimProofRequest.init(APP_ID, APP_SECRET, PROVIDER_ID);
 
    // 認証リクエストURLを生成
    const requestUrl = await reclaimProofRequest.getRequestUrl();
    setRequestUrl(requestUrl);
 
    // プルーフの提出を監視開始
    await reclaimProofRequest.startSession({
      onSuccess: (proofs) => {
        setProofs(proofs);
        setIsVerified(true);
        
        try {
          // プルーフからユーザーデータを抽出
          let extractedData = null;
          
          // proofsが配列の場合
          if (Array.isArray(proofs) && proofs.length > 0) {
            if (proofs[0].publicData) {
              extractedData = {
                username: proofs[0].publicData.username || 'N/A',
                creationYear: proofs[0].publicData.creationYear || 'N/A',
                contributionsLastYear: proofs[0].publicData.contributionsLastYear || 'N/A'
              };
            }
          } 
          // proofsがpublicDataを持つオブジェクトの場合
          else if (proofs && proofs.publicData) {
            extractedData = {
              username: proofs.publicData.username || 'N/A',
              creationYear: proofs.publicData.creationYear || 'N/A',
              contributionsLastYear: proofs.publicData.contributionsLastYear || 'N/A'
            };
          }
          
          if (extractedData) {
            setUserData(extractedData);
          }
        } catch (error) {
          console.error('ユーザーデータの抽出中にエラーが発生しました:', error);
        }
      },
      onError: (error) => {
        console.error('認証に失敗しました', error);
      },
    });
  };
 
  return (
    <div style={{ 
      backgroundColor: 'white', 
      borderRadius: '8px', 
      padding: '20px', 
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      maxWidth: '600px',
      margin: '0 auto'
    }}>
      <button 
        onClick={getVerificationReq}
        style={{
          backgroundColor: '#4a6baf',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '16px'
        }}
      >
        認証リクエストを取得
      </button>

      {requestUrl && !isVerified && (
        <div style={{ margin: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <p style={{ color: '#555', marginBottom: '15px' }}>このQRコードをスキャンして認証を完了してください</p>
          <QRCode value={requestUrl} />
        </div>
      )}

      {isVerified && (
        <div style={{ 
          margin: '20px 0', 
          padding: '15px', 
          backgroundColor: '#e8f5e9', 
          borderRadius: '4px',
          borderLeft: '4px solid #4caf50'
        }}>
          <h2 style={{ color: '#2e7d32', marginTop: 0 }}>ログインに成功しWeb証明を生成しました！</h2>
          
          {userData ? (
            <div style={{ 
              backgroundColor: '#fff', 
              padding: '15px', 
              borderRadius: '4px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              marginBottom: '15px'
            }}>
              <h3 style={{ color: '#4a6baf', marginTop: 0 }}>Github プロフィール情報</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '10px', alignItems: 'center' }}>
                <div style={{ fontWeight: 'bold' }}>ユーザーネーム：</div>
                <div>{userData.username}</div>
                
                <div style={{ fontWeight: 'bold' }}>Creation Year：</div>
                <div>{userData.creationYear}</div>
                
                <div style={{ fontWeight: 'bold' }}>Contribution Last Year：</div>
                <div>{userData.contributionsLastYear}</div>
              </div>
            </div>
          ) : (
            <div style={{ color: '#d32f2f', marginBottom: '15px' }}>
              プロフィール情報を取得できませんでした。詳細データを確認してください。
            </div>
          )}
          
          <details>
            <summary style={{ cursor: 'pointer', color: '#555', marginBottom: '10px' }}>詳細データを表示</summary>
            <pre style={{ 
              backgroundColor: '#f5f5f5', 
              padding: '10px', 
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '14px'
            }}>
              {JSON.stringify(proofs, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
 
export default ReclaimDemo;