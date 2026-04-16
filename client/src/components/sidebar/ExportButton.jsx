import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore.js';
import Button from '../ui/Button.jsx';

export default function ExportButton() {
  const { currentSession, messages, sources } = useAppStore();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!currentSession) return;
    setIsExporting(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      const diseaseKebab = (currentSession.disease || 'research').toLowerCase().replace(/\s+/g, '-');
      const filename = "curalink-" + diseaseKebab + ".pdf";

      doc.setFontSize(20);
      doc.text("Research Brief: " + (currentSession.disease || 'N/A'), 20, 20);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text("Generated: " + new Date().toLocaleDateString(), 20, 30);
      const loc = [currentSession.location?.city, currentSession.location?.country].filter(Boolean).join(', ');
      if (loc) doc.text("Location Context: " + loc, 20, 36);

      const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant' && m.structuredAnswer);
      const lastAnswer = lastAssistant?.structuredAnswer;
      
      let yPos = 50;

      if (lastAnswer) {
        if (lastAnswer.condition_overview) {
          doc.setFontSize(14);
          doc.setTextColor(0);
          doc.text('Overview', 20, yPos);
          yPos += 8;
          doc.setFontSize(10);
          doc.setTextColor(60);
          let splitText = doc.splitTextToSize(lastAnswer.condition_overview || '', 170);
          doc.text(splitText, 20, yPos);
          yPos += splitText.length * 5 + 10;
        }

        if (lastAnswer.research_insights?.length > 0) {
          if (yPos > 250) { doc.addPage(); yPos = 20; }
          doc.setFontSize(14);
          doc.setTextColor(0);
          doc.text('Key Research Findings', 20, yPos);
          yPos += 8;
          
          lastAnswer.research_insights.slice(0, 5).forEach((insight) => {
            if (yPos > 270) { doc.addPage(); yPos = 20; }
            doc.setFontSize(10);
            doc.setTextColor(0);
            const text = "• [" + insight.type + "] " + insight.insight;
            const splitText = doc.splitTextToSize(text, 170);
            doc.text(splitText, 20, yPos);
            yPos += splitText.length * 5 + 4;
          });
          yPos += 6;
        }
      }

      if (sources && sources.length > 0) {
        if (yPos > 250) { doc.addPage(); yPos = 20; }
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text('Sources', 20, yPos);
        yPos += 8;

        sources.slice(0, 8).forEach((src, idx) => {
          if (yPos > 270) { doc.addPage(); yPos = 20; }
          doc.setFontSize(10);
          doc.setTextColor(60);
          const title = src.title || 'Untitled document';
          const srcText = (idx + 1) + ". [" + src.source + "] " + title + " (" + (src.year || 'N/A') + ")";
          const splitSrc = doc.splitTextToSize(srcText, 170);
          doc.text(splitSrc, 20, yPos);
          yPos += splitSrc.length * 5 + 3;
        });
      }

      doc.save(filename);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      onClick={handleExport} 
      disabled={isExporting || !currentSession}
      className="w-full"
    >
      {isExporting ? 'Generating PDF...' : 'Export Research Brief PDF'}
    </Button>
  );
}
